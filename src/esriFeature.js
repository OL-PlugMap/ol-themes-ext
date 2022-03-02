
import TileGrid from "ol/tilegrid/TileGrid"
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import {createXYZ} from 'ol/tilegrid';
import { Fill, Stroke, Style, CircleStyle } from 'ol/style';
import { applyStyle } from 'ol-mapbox-style';
import EsriJSON from 'ol/format/EsriJSON';
import { get } from "ol/proj";
import { getWidth } from "ol/extent";
import {tile as tileStrategy} from 'ol/loadingstrategy';
import { getLogger, getWarning } from "./logger";
import { createStyleFunction, setMapProjection, readEsriStyleDefinitions } from 'ol-esri-style';


const esrijsonFormat = new EsriJSON();

export const generate = (data, core) => {
    let layers = data.config.value.endpoints.map(endpoint => {
    //The random adds a random value to the parameter
    //essentually cache busting  
    let customParams = {
      get random() {
        return Math.random();
      }
    };

    if (endpoint.bbox) {
      customParams["BBOX"] = endpoint.bbox;
    }

    if (endpoint.layersToShow) {
      customParams["LAYERS"] = endpoint.layersToShow;
    }

    if (data.config.value.layerDefs) {
      customParams["layerDefs"] = data.config.value.layerDefs
    }

    var projExtent = get('EPSG:3857').getExtent();
    var startResolution = getWidth(projExtent) / 256;
    var resolutions = new Array(22);
    for (var i = 0, ii = resolutions.length; i < ii; ++i) {
      resolutions[i] = startResolution / Math.pow(2, i);
    }
    var tileGrid = new TileGrid({
      extent: [-13884991, 2870341, -7455066, 6338219],
      resolutions: resolutions,
      tileSize: [256, 256]
    });


    endpoint.styleCache = {};
    endpoint.styleFunction = function(feature)
    {
      if(!endpoint.styleCache)
      {
        return new Style({
          fill: new Fill({
            color: "rgba(255,0,0,0.5)"
          }),
          stroke: new Stroke({
            color: "rgba(255,0,255,0.75)",
            width: 4
          })
        })
      }
      else
      {
        if(feature.get(endpoint.styleCache.field))
        {
          if(endpoint.styleCache.map[feature.get(endpoint.styleCache.field)])
          {
            return endpoint.styleCache.map[feature.get(endpoint.styleCache.field)];
          }
          else
          {
            getLogger()("Cant find mapped value for " + feature.get(endpoint.styleCache.field))
            return new Style({
              fill: new Fill({
                color: "rgba(255,0,0,0.5)"
              }),
              stroke: new Stroke({
                color: "rgba(255,0,255,0.75)",
                width: 4
              })
            })
          }
        }
      }
    }


    window.fetch(endpoint.url + "?f=json")
      .then(resp => { return resp.json() } )
      .then(meta => {
        try
        {
          getLogger()("Style", meta);
          setMapProjection(core.getMap().getView().getProjection());
          
          createStyleFunction(meta).then(styleFunction => {
            getLogger()("Debug stuff here");
            endpoint.styleFunction = (feature, resolution) => {
              getLogger()(feature);
              return styleFunction(feature, resolution);
            }

            getLogger()("Setting FN");
            endpoint.layerRef.setStyle(endpoint.styleFunction);
          })
          .catch((err) => {
            getLogger()("Catch", err);
            endpoint.styleFunction = (feature) => {
              return new Style({
                fill: new Fill({
                  color: "rgba(255,0,0,0.5)"
                }),
                stroke: new Stroke({
                  color: "rgba(255,0,255,0.75)",
                  width: 4
                })
              })
            };

            getLogger()("Setting FN");
            endpoint.layerRef.setStyle(endpoint.styleFunction);
          })
        }
        catch(ex)
        {
          getLogger()("Exception", ex);
          endpoint.styleFunction = (feature) => {
            return new Style({
              fill: new Fill({
                color: "rgba(255,0,0,0.5)"
              }),
              stroke: new Stroke({
                color: "rgba(255,0,255,0.75)",
                width: 4
              })
            })
          };

          getLogger()("Setting FN");
          endpoint.layerRef.setStyle(endpoint.styleFunction);
        }
        
        // var rend = (meta && meta.drawingInfo ? meta.drawingInfo.renderer : {}) || {} ;
        // if(!rend)
        // {
        //   getWarning()("The included service didnt have drawing info. This can happen if you dont pass in the layer with the url. For example: somedomain.com/somepath/FeatureServer/0/");
        //   endpoint.styleCache = false;
        //   return;
        // }

        // let rendererType = rend.type;

        // switch(rendererType)
        // {
        //   case "uniqueValue": {
        //     getLogger()("Found a unique value renderer");
        //     if(rend.field2)
        //     {
        //       getWarning()("This renderer has multiple fields. Currently only the first field is supported, the rest are ignored. Please open an issue on this library with the following values.", endpoint, rend);
        //     }
        //     var field = rend.field1;
        //     endpoint.styleCache.field = field;
        //     endpoint.styleCache.map = {};
        //     for(var inf of rend.uniqueValueInfos)
        //     {
        //       var sym = inf.symbol;
        //       endpoint.styleCache.map[inf.value] =
        //         new Style({
        //           fill: new Fill({
        //             color: `rgba(${sym.color[0]},${sym.color[1]},${sym.color[2]},${sym.color[3]/255})`
        //           }),
        //           stroke: new Stroke({
        //             color: `rgba(${sym.outline.color[0]},${sym.outline.color[1]},${sym.outline.color[2]},${sym.outline.color[3]/255})`,
        //             width: sym.outline.width || 4
        //           })
        //         })
        //     }
        //   }; break;

        //   default: {
        //     getWarning()("Unsupported renderer detected. Please open an issue on this library with the following value.", endpoint, rend)
        //   }; break;

        // }

        
      })
      .catch(a => {
          getWarning()("Unable to get style from provided URL", endpoint.url, a. endpoint)
          endpoint.styleCache = false;
      });

    

    let source = new VectorSource({
      loader: function (extent, resolution, projection) {
        let outfields = endpoint.outfields ? endpoint.outfields.join(",") : "*";
        var url =
          endpoint.url +
          '/query/?f=json&' +
          'returnGeometry=true&spatialRel=esriSpatialRelIntersects&geometry=' +
          encodeURIComponent(
            '{"xmin":' +
              extent[0] +
              ',"ymin":' +
              extent[1] +
              ',"xmax":' +
              extent[2] +
              ',"ymax":' +
              extent[3] +
              ',"spatialReference":{"wkid":102100}}'
          ) +
          '&geometryType=esriGeometryEnvelope&inSR=102100&outSR=102100&outFields=' + outfields
          '&outSR=102100';
        window.fetch(url)
        .then((response) => { return response.text() })
        .then((txt) => {
              var features = esrijsonFormat.readFeatures(txt, {
                featureProjection: projection,
              });
              if (features.length > 0) {
                source.addFeatures(features);
              }
            //}
          },
        )
        .catch((err) => {
          getWarning()("Unhandled exception in esri feature loader", err)
        })
      },
      strategy: tileStrategy(
        createXYZ({
          tileSize: 512,
        })
      ),
    });

    let style = endpoint.style || {};

    let lyr = new VectorLayer({
      source: source,
      zIndex: endpoint.zIndex || 0,
      opacity: data.opacity || 1,
      style: endpoint.styleFunction
    });
    lyr.set('id', data.key);

    lyr.getLegend = async () => {
      if(endpoint.legend)
        return endpoint.legend;
      try
        {

          let meta = await (await fetch(endpoint.url + "?f=json")).json();
          let styles = readEsriStyleDefinitions(meta.drawingInfo);
          endpoint.legend = styles.featureStyles.map(entry => {

            let val = {
              label: entry.title,
            }
            
            if(entry.fill && entry.fill.color)
            {
              val.color = entry.fill.color;
            }

            return val;
          })
        }
        catch(ex)
        {
          debugger;
          getLogger()("Exception", ex);
        }

      return endpoint.legend;
    }

    source.applyFilters =
      function (ls) {
        if (!Array.isArray(ls) && ls.filts)
          ls = ls.filts;
        ls.forEach(layer => {

          var def = {};
          var conditions = [];
          layer.values.forEach(value => {
            if (value.applied && value.filter && value.filter.all && value.filter.all.length > 0) {
              var indiConds = [];
              value.filter.all.forEach(condition => {

                if (condition.values.exact) {
                  indiConds.push("( " + condition.field + " = '" + condition.values.exact + "' )")
                } else if (condition.values.range) {
                  indiConds.push("( " + condition.field + " > '" + condition.values.greaterThan + "' AND " + condition.field + " < '" + condition.values.lessThan + "')")
                }

              })

              var finalCond = "(" + indiConds.join(" AND ") + ")";
              conditions.push(finalCond);
            }
          });

          var finalFilter = "";
          switch (layer.mode) {
            case "OR": finalFilter = conditions.join(" OR "); break;
            case "AND": finalFilter = conditions.join(" AND "); break;
          }

          if (finalFilter.length > 0) {
            def[layer.layerid] = finalFilter;
            def = JSON.stringify(def);
          }
          else {
            def = ""
          }


          let olddef = source.params_["layerDefs"];
          let newdef = def;

          this.params_["layerDefs"] = def;
          if (olddef != newdef) {
            if (newdef.length > 0) {
              lyr.setVisible(true);
              if (this.tileCache) {
                this.tileCache.clear();
              }
              this.changed();
            }
            else {
              lyr.setVisible(false);
            }
          }
        })
      };

    source.clearFilters =
      function (layer) {
        var def = {};
        def[layer.layerid] = "0=1";
        def = JSON.stringify(def);

        let olddef = source.params_["layerDefs"];
        let newdef = def;

        this.params_["layerDefs"] = def;

        lyr.setVisible(false);

        if (olddef != newdef) {
          if (this.tileCache) {
            this.tileCache.clear();
          }
          this.changed();
        }
      }

    let configureSource = function (tokenKey) {
      if (core.services && core.services[tokenKey]) {
        let tokenData = core.services[tokenKey];
        source.setUrl(`${tokenData.baseUrl || ""}${endpoint.url}`);
        if (tokenData.token) {
          customParams["token"] = tokenData.token;
        }
        source.params_ = customParams;
      }
    }

    // if (endpoint.tokenKey) {
    //   // if the token data has already been fetched and stored in core.services
    //   // go ahead and configure the source w/ the data, otherwise, postpone
    //   // the configuration until `setServicesCmd` has been triggered
    //   if (core.services && core.services[endpoint.tokenKey]) {
    //     configureSource(endpoint.tokenKey);
    //   } else {
    //     self.pendingConfiguration.push({
    //       name: data.key,
    //       fn: configureSource,
    //       params: [endpoint.tokenKey]
    //     });
    //   }
    // }
    // else {
    //   source.setUrl(endpoint.url);
    //   source.params_ = customParams;
    // }
    lyr.setVisible(false);
    endpoint.layerRef = lyr;
    return lyr;
  });

  return layers;
};