import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';

import VectorTileLayer from 'ol/layer/VectorTile';
import VectorTileSource from 'ol/source/VectorTile';
import MVT from 'ol/format/MVT';
import { Fill, Stroke, Style } from 'ol/style';


export function generate(data) {
    var layers = data.config.value.endpoints.map(endpoint => {

        endpoint.highlightFeats = {};

        var filterEngine = function (feature) {
          var renderFeature = true;
          var fev =
          {
            render: false
            , renderFn: function () { return false; }
            , filtersRan: false
            , filtersChecked: {}
          }

          if (endpoint.filter) {
            fev.filtersRan = true;
            renderFeature = true;
            var keys = Object.keys(endpoint.filter);
            keys.forEach(key => {
              var filterResult =
              {
                checked: true
                , result: false
                , valuesChecked: {}
              }

              var valuesMet = [];
              endpoint.filter[key].values.forEach(value => {
                var valueResult =
                {
                  conditionMet: false
                }
                if (value.filter.all) {
                  var allMet = true;
                  value.filter.all.forEach(filter => {
                    if (!feature || !feature.properties_) {
                    }
                    if (feature.properties_[filter.field]) {
                      if (filter.values && filter.values.exact) {
                        allMet = allMet && (feature.properties_[filter.field] + "") == filter.values.exact;
                      }
                      else if (filter.values && (filter.values.greaterThan != undefined)) {
                        var value = feature.properties_[filter.field];

                        allMet = allMet && (value >= filter.values.greaterThan) && (value < filter.values.lessThan);
                      }
                      else if (filter.values && filter.values.null) {
                        allMet = allMet && (feature.properties_[filter.field] == undefined || feature.properties_[filter.field] == null)
                      }
                      else {
                        allMet = false;
                      }
                    }
                    else if (filter.values.null) {
                      allMet = true;
                    } else {
                      allMet = false;
                    }
                  });

                  valueResult.conditionMet = allMet;
                  filterResult[value.name] = valueResult;

                  //feature.properties_["FilterEngine_" + key + "_allMet_" + value.name] = allMet;

                  valuesMet.push(allMet);
                }

                if (value.filter.any) {
                  var allMet = false;
                  value.filter.any.forEach(filter => {
                    if (!feature || !feature.properties_) {
                    }
                    if (feature.properties_[filter.field]) {
                      if (filter.values && filter.values.exact) {
                        allMet = allMet || (feature.properties_[filter.field] + "") == filter.values.exact;
                      }
                      else if (filter.values && (filter.values.greaterThan != undefined)) {
                        var value = feature.properties_[filter.field];

                        allMet = allMet || (value >= filter.values.greaterThan) && (value < filter.values.lessThan);
                      }
                      else if (filter.values && filter.values.null) {
                        allMet = allMet || (feature.properties_[filter.field] == undefined || feature.properties_[filter.field] == null)
                      }
                      else {
                        allMet = false;
                      }
                    }
                    else if (filter.values.null) {
                      allMet = true;
                    } else {
                      allMet = false;
                    }
                  });

                  valueResult.conditionMet = allMet;
                  filterResult[value.name] = valueResult;

                  //feature.properties_["FilterEngine_" + key + "_allMet_" + value.name] = allMet;

                  valuesMet.push(allMet);
                }

                fev.filtersChecked[key] = filterResult;
              });


              var renderThisFeature = false || endpoint.filter[key].values.length == 0;

              if (endpoint.filter[key].mode == "OR") {
                valuesMet.forEach(value => {
                  renderThisFeature = renderThisFeature || value;
                })
              }

              if (endpoint.filter[key].mode == "AND") {
                var renderThisFeature = true;
                valuesMet.forEach(value => {
                  renderThisFeature = renderThisFeature && value;
                })
              }

              filterResult.result = renderThisFeature;

              fev.filtersChecked[key] = filterResult;



              //feature.properties_["FilterEngine_" + key + "_render"] = renderThisFeature
              if (endpoint.filterMode == "AND")
                renderFeature = renderFeature && renderThisFeature;
              else
                renderFeature = renderFeature || renderThisFeature;
            })

          }

          fev.renderFn = function () {
            let flt = endpoint.filter;
            let filterSets = Object.keys(flt);
            let render = true;

            if (endpoint.filterMode == "AND") {
              render = true;
            }
            else {
              render = false;
            }

            for (var i = 0; i < filterSets.length; i++) {
              var filterSet = flt[filterSets[i]];

              var match = false; // || filterSet.values.length == 0;
              var orMode = true;

              if (filterSet.mode == "AND") {
                match = true;
                orMode = false;
              }


              for (var t = 0; t < filterSet.values.length; t++) {
                var value = filterSet.values[t];
                var fc = fev.filtersChecked[filterSets[i]]
                if (!fc) {
                  debugger;
                  //We gonna crash ... why ...
                }
                var condVal = fc[value.name]

                if (value.applied) {
                  if (orMode) {
                    match = match || condVal.conditionMet;
                    if (match)
                      break;
                  }
                  else {
                    match = match && condVal.conditionMet;
                    if (!match)
                      break
                  }

                }
              }

              if (endpoint.filterMode == "AND") {
                render = render && match;
                if (!render) {
                  break;
                }
              }
              else {
                render = render || match;
                if (render) {
                  break;
                }
              }
            }
            fev.render = render;

          }

          feature.properties_["FilterEngine"] = fev;



          //feature.properties_["FilterEngine_render"] = renderFeature
          return renderFeature;
        }

        var styleFn = function (endpoint, source, layer) {

          if (endpoint.style) {
            if (endpoint.style.url) {
              let that = layer;
              that.handleError = function(err) { console.error(err); };
              let SourceType = { VECTOR : "vector" }
              fetch(endpoint.style.url).then(resp => {
                if (resp.ok)
                  return resp.json();
                throw new Error(`Unexpected error: ${resp.status}`)
              }).then((style) => {
                let sourceId;
                let sourceIdOrLayersList;
                if (that.layers) {
                  // confirm all layers share the same source
                  const lookup = {};
                  for (let i = 0; i < style.layers.length; ++i) {
                    const layer = style.layers[i];
                    if (layer.source) {
                      lookup[layer.id] = layer.source;
                    }
                  }
                  let firstSource;
                  for (let i = 0; i < that.layers.length; ++i) {
                    const candidate = lookup[that.layers[i]];
                    if (!candidate) {
                      that.handleError(
                        new Error(`could not find source for ${that.layers[i]}`)
                      );
                      return;
                    }
                    if (!firstSource) {
                      firstSource = candidate;
                    } else if (firstSource !== candidate) {
                      that.handleError(
                        new Error(
                          `layers can only use a single source, found ${firstSource} and ${candidate}`
                        )
                      );
                      return;
                    }
                  }
                  sourceId = firstSource;
                  sourceIdOrLayersList = that.layers;
                } else {
                  sourceId = that.sourceId;
                  sourceIdOrLayersList = sourceId;
                }

                if (!sourceIdOrLayersList) {
                  // default to the first source in the style
                  sourceId = Object.keys(style.sources)[0];
                  sourceIdOrLayersList = sourceId;
                }

                if (style.sprite) {
                  style.sprite = normalizeSpriteUrl(style.sprite, that.accessToken, endpoint.style.url);
                }

                if (style.glyphs) {
                  style.glyphs = normalizeGlyphsUrl(style.glyphs, that.accessToken, endpoint.style.url);
                }

                const styleSource = style.sources[sourceId];
                let SourceType = { VECTOR : "vector" }
                let SourceState = { READY : "ready" }
                if (styleSource.type !== "vector") {
                  that.handleError(
                    new Error(`only works for vector sources, found ${styleSource.type}`)
                  );
                  return;
                }

                const source = that.getSource();

                //source.setUrl(normalizeSourceUrl(styleSource.url, that.accessToken, endpoint.style.url));

                applyStyle(that, style, sourceIdOrLayersList)
                  .then(() => {
                    source.setState(SourceState.READY);
                  })
                  .catch((error) => {
                    that.handleError(error);
                  });
              })
            }
            else if (endpoint.style.static) {
              var style = endpoint.style.static;

              return new Style({
                fill: new Fill({
                  color: style.fillColor || "rgba(255,0,0,0.5)"
                }),
                stroke: new Stroke({
                  color: style.strokeColor || "rgba(255,0,255,0.75)",
                  width: style.strokeWidth != undefined ? style.strokeWidth : 4
                })
              })
            }
            else if (endpoint.style.dynamic) {
              return function (feature) {

                if (endpoint.highlightFeats[feature.properties_.id]) {
                  return new Style({
                    fill: new Fill({
                      color: "rgba(255,255,0,1)"
                    }),
                    stroke: new Stroke({
                      color: "rgba(255,255,0,0)",
                      width: 0
                    })
                  })
                }

                var renderFeature = true;
                var fev = feature.get("FilterEngine");
                var r = true;

                if (fev && fev.renderFn) {
                  fev.renderFn();
                  r = fev.render;
                }

                renderFeature = feature.get("selected") || r;

                let map = endpoint.style.dynamic.map;
                let field = endpoint.style.dynamic.field;
                if (!renderFeature) {
                  return new Style({
                    fill: new Fill({
                      color: "rgba(0,0,0,0)"
                    }),
                    stroke: new Stroke({
                      color: "rgba(0,0,0,0)",
                      width: 0
                    })
                  })
                } else if (feature.get("selected")) {
                  return new Style({
                    fill: new Fill({
                      color: "rgba(255,255,100,0.7)"
                    }),
                    stroke: new Stroke({
                      color: "rgba(255,255,0,1)",
                      width: 1
                    })
                  })
                } else if (feature && feature.properties_ && feature.properties_[field]) {
                  var val = feature.properties_[field] + "";
                  if (map[val]) {
                    var style = map[val];
                    return new Style({
                      fill: new Fill({
                        color: style.fillColor || "rgba(255,0,0,0.5)"
                      }),
                      stroke: new Stroke({
                        color: style.strokeColor || "rgba(255,0,255,0.75)",
                        width: style.strokeWidth != undefined ? style.strokeWidth : 4
                      })
                    })
                  }
                  else {
                    //Need default style

                    return new Style({
                      fill: new Fill({
                        color: "rgba(255,255,255,0)"
                      }),
                      stroke: new Stroke({
                        color: "rgba(0,0,0,0)",
                        width: 4
                      })
                    })
                  }
                }

              }
            }
          }
          else {
            return new Style({
              fill: new Fill({
                color: endpoint.fillColor || "rgba(255,0,0,0.5)"
              }),
              stroke: new Stroke({
                color: endpoint.strokeColor || "rgba(255,0,255,0.75)",
                width: style.strokeWidth != undefined ? style.strokeWidth : 4
              })
            })
          }
        };

        var url = endpoint.url;

        var source = new VectorTileSource({
          maxZoom: 15,
          format: new MVT({
            idProperty: 'iso_a3'
          }),
          url: url
        });

        if(endpoint.headers)
        {
          var loader = function(tile, url) {
            tile.setLoader(function(extent, resolution, projection) {
              var fetchModel =
                {
                  method: 'GET',
                  mode: 'cors',
                  cache: 'no-cache',
                  headers: endpoint.headers
                };
                
              fetch(url, fetchModel).then(function(response) {
                response.arrayBuffer().then(function(data) {
                  const format = tile.getFormat()
                  const features = format.readFeatures(data, {
                    extent: extent,
                    featureProjection: projection
                  });
                  tile.setFeatures(features);
                });
              });
            });
          }

          source.setTileLoadFunction(loader);
        }

        // source.on("tileloadend", evt => {
        //   var f = evt.tile.getFeatures();
        //   f.forEach(filterEngine);
        // })

        let configureSource = function (tokenKey) {
          if (core.services && core.services[tokenKey]) {
            let tokenData = core.services[tokenKey];
            source.setUrl(`${tokenData.baseUrl || ""}${endpoint.url}`);
          }
        }
        if (endpoint.tokenKey) {
          // if the token data has already been fetched and stored in core.services
          // go ahead and configure the source w/ the data, otherwise, postpone
          // the configuration until `setServicesCmd` has been triggered
          if (core.services && core.services[endpoint.tokenKey]) {
            configureSource(endpoint.tokenKey);
          } else {
            self.pendingConfiguration.push({
              name: data.key,
              fn: configureSource,
              params: [endpoint.tokenKey]
            });
          }
        }

        var vtLayer = new VectorTileLayer({
          declutter: true,
          source: source,
          zIndex: endpoint.zIndex || 1000

        });

        vtLayer.style = styleFn(endpoint, source, vtLayer);
        vtLayer.setStyle(styleFn(endpoint, source, vtLayer))

        vtLayer.set('id', data.key);
        source.refreshFunction =
          function () {
            source.changed();
            source.refresh();
          }
        source.highlight =
          function (feature) {
            endpoint.highlightFeats[feature] = true;
            this.changed();
          }

        source.unhighlight =
          function (feature) {
            delete endpoint.highlightFeats[feature];
            this.changed();
          }


        source.applyFilters =
          function (layerset) {
            if (!endpoint.filter)
              endpoint.filter = {};

            if (Array.isArray(layerset.filts)) {
              layerset.filts.forEach(lyr => {
                //todo remove the test 
                endpoint.filter['test_' + lyr.layerid] = lyr;
              })
            }

            endpoint.filterMode = layerset.mode;

            var epk = Object.keys(endpoint.filter)

            var anyApplied = false;

            for (var i = 0; i < epk.length && !anyApplied; i++) {
              var f = endpoint.filter[epk[i]];
              for (var v = 0; v < f.values.length && !anyApplied; v++) {
                anyApplied = anyApplied || f.values[v].applied
              }
            }

            if (source.inview)
              vtLayer.setVisible(true);

            if (anyApplied) {
              if (!source.inview)
                vtLayer.setVisible(true);
              this.changed();
            }
            else {
              if (!source.inview)
                vtLayer.setVisible(false);
              this.changed();
            }


          };

        source.clearFilters =
          function (layer) {
            if (!endpoint.filter)
              endpoint.filter = {};
            delete endpoint.filter['test_' + layer.layerid];

            if (Object.keys(endpoint.filter).length == 0) {
              vtLayer.setVisible(false);
            }

            this.changed();
          }

        source.filterEngine = filterEngine;

        //vtLayer.setVisible(false);
        

        return vtLayer;
      });

    return layers;
}