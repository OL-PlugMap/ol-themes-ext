import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';

import VectorTileLayer from 'ol/layer/VectorTile';
import VectorTileSource from 'ol/source/VectorTile';
import MVT from 'ol/format/MVT';
import { Fill, Stroke, Style } from 'ol/style';


let dynamicStyling = (endpoint, source) => {
  return function (feature) {
    if (source.highlightFeats[feature.properties_.id]) {
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

let _filterEngine = (source) => {
  (feature) => {
    var renderFeature = true;
    var fev =
    {
      render: false
      , renderFn: function () { return false; }
      , filtersRan: false
      , filtersChecked: {}
    }

    if (source.filter) {
      fev.filtersRan = true;
      renderFeature = true;
      var keys = Object.keys(source.filter);
      keys.forEach(key => {
        var filterResult =
        {
          checked: true
          , result: false
          , valuesChecked: {}
        }

        var valuesMet = [];
        source.filter[key].values.forEach(value => {
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


        var renderThisFeature = false || source.filter[key].values.length == 0;

        if (source.filter[key].mode == "OR") {
          valuesMet.forEach(value => {
            renderThisFeature = renderThisFeature || value;
          })
        }

        if (source.filter[key].mode == "AND") {
          var renderThisFeature = true;
          valuesMet.forEach(value => {
            renderThisFeature = renderThisFeature && value;
          })
        }

        filterResult.result = renderThisFeature;

        fev.filtersChecked[key] = filterResult;



        //feature.properties_["FilterEngine_" + key + "_render"] = renderThisFeature
        if (source.filterMode == "AND")
          renderFeature = renderFeature && renderThisFeature;
        else
          renderFeature = renderFeature || renderThisFeature;
      })

    }

    fev.renderFn = function () {
      let flt = source.filter;
      let filterSets = Object.keys(flt);
      let render = true;

      if (source.filterMode == "AND") {
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

        if (source.filterMode == "AND") {
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
  };
}


let _styleFunction = (endpoint, source, layer) => {

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
      return dynamicStyling(endpoint, source);
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


let _applyFilters = (source, vtLayer) => {
  //TODO: Can we interpret vtLayer or source based off the other?
  return (layerset) => {
    if (!source.filter)
    source.filter = {};

    if (Array.isArray(layerset.filts)) {
      layerset.filts.forEach(lyr => {
        //todo remove the test 
        source.filter['test_' + lyr.layerid] = lyr;
      })
    }

    source.filterMode = layerset.mode;

    var epk = Object.keys(source.filter)

    var anyApplied = false;

    for (var i = 0; i < epk.length && !anyApplied; i++) {
      var f = source.filter[epk[i]];
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
};


let _clearFilters = (source) => {
  (layer) => {
    if (!source.filter)
    source.filter = {};
    delete endpoint.filter['test_' + layer.layerid];

    if (Object.keys(source.filter).length == 0) {
      vtLayer.setVisible(false);
    }

    this.changed();
  };
};

let _unhighlight = (source) => {
  return (feature) => {
    delete source.highlightFeats[feature];
    this.changed();
  };
};

let _highlight = (source) => {
  source.highlightFeats = {};
  return (feature) => {
    source.highlightFeats[feature] = true;
    source.changed();
  };
};

let _refreshFunction = (source) =>
{
  return () => {
    source.changed();
    source.refresh();
  };
};

let _loader = (endpoint) => {
  return function(tile, url) {
    tile.setLoader(function(extent, resolution, projection) {
      var fetchModel =
        {
          method: 'GET',
          mode: 'cors',
          cache: 'no-cache',
          headers: endpoint.headers
        };
      tile.status__ = "loading";
      fetch(url, fetchModel).then(function(response) {
        tile.status__ = "loaded";
        response.arrayBuffer().then(function(data) {
          const format = tile.getFormat()
          const features = format.readFeatures(data, {
            extent: extent,
            featureProjection: projection
          });
          tile.setFeatures(features);
        });
      })
      .catch(err => {
        tile.status__ = "error";
      });
    });
  }
};


let _deduplicateFeatures = (features) => {
  let rets = {};

  features.forEach((feat) => {
    rets[feat.getId()+""] = feat;
  });

  var keys = Object.keys(rets);

  var ret = [];

  keys.forEach(key => {
    ret.push(rets[key]);
  });

  return ret;
};

let _getFeaturesInView = (source, map) => {
  return async () => {
    return getLoadingPromise(vtLayer).then(async () => {
      let features = source.getFeaturesInExtent(map.getView().calculateExtent());
      
      let ret = _deduplicateFeatures(features);

      return ret;
    });
  }
};


let getLoadingPromise = (vtLayer) => {
  let resolve_, reject_ = null;
  let promise = new Promise((resolve,reject) => {
    resolve_ = resolve; reject_ = reject;
  });

  if(!vtLayer.loadPromiseResolves)
    vtLayer.loadPromiseResolves = [];
  vtLayer.loadPromiseResolves.push(resolve_);

  return promise;
}

let _getFeaturesUnderPixel = (vtLayer) => {
  return async (pixel) => {
    return getLoadingPromise(vtLayer).then(async () => {
      let features = await vtLayer.getFeatures(pixel);
      
      let ret = _deduplicateFeatures(features);

      return ret;
    });
  }
};

let _configureSource = (tokenKey) => {
  if (core.services && core.services[tokenKey]) {
    let tokenData = core.services[tokenKey];
    source.setUrl(`${tokenData.baseUrl || ""}${endpoint.url}`);
  }
};

//TODO: Make a function that, if tiles are loaded installs a promise
//Change the below to check if the promise(s) exist
//When they exist and load has finished then resolve them

let isLoadingTiles = (source) => {
  return source.sourceTileCache.getValues().filter(tile => { return tile.status__ == "loading" });
}

let handlePostRender = (source, vtLayer) => {
  
  vtLayer.loadPromise = new Promise((resolve,reject) => {
    vtLayer.loadPromiseResolve = resolve;
    vtLayer.loadPromiseReject = reject;
  });

  return (evt) => {
    let loadingTiles = source.sourceTileCache.getValues().filter(tile => { return tile.status__ == "loading" });
    let loadingTilesCount = loadingTiles.length;

    if(loadingTilesCount > 0)
    {
      //Still loading
    }
    else
    {
      //Loaded! Fire the loaded promise 
      if(vtLayer.loadPromiseResolves)
      {
        vtLayer.loadPromiseResolves.forEach(resolve => {
          resolve("Looded")
        });
        vtLayer.loadPromiseResolves = null;
      }
    }
  }
}

export function generate(data, core) {
    var layers = data.config.value.endpoints.map(endpoint => {
        var url = endpoint.url;

        var source = new VectorTileSource({
          maxZoom: 15,
          format: new MVT({
            idProperty: 'id'
          }),
          url: url
        });

        if(endpoint.headers)
        {
          var loader = _loader(endpoint);

          source.setTileLoadFunction(loader);
        }

        let configureSource = _configureSource;

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

        vtLayer.style = _styleFunction(endpoint, source, vtLayer);
        vtLayer.setStyle(_styleFunction(endpoint, source, vtLayer))

        vtLayer.set('id', data.key);
        
        vtLayer.refreshFunction = _refreshFunction(source);

        vtLayer.highlight = _highlight(source);

        vtLayer.unhighlight = _unhighlight(source);

        vtLayer.applyFilters = _applyFilters(source, vtLayer);
          
        vtLayer.clearFilters = _clearFilters(source);

        vtLayer.filterEngine = _filterEngine(source);

        vtLayer.getFeaturesInView = _getFeaturesInView(source, core.getMap())

        vtLayer.getFeaturesUnderPixel = _getFeaturesUnderPixel(vtLayer);
      
        vtLayer.on('postrender', handlePostRender(source, vtLayer));
        source.on('tileloadend', handlePostRender(source, vtLayer));
        source.on('tileloaderror', handlePostRender(source, vtLayer));

        return vtLayer;
      });

    return layers;
}