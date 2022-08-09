
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import {createXYZ} from 'ol/tilegrid';
import { Fill, Stroke, Style} from 'ol/style';
import EsriJSON from 'ol/format/EsriJSON';
import {tile as tileStrategy} from 'ol/loadingstrategy';
import { getLogger, getWarning } from "./logger";
import { createStyleFunction, readEsriStyleDefinitions } from 'ol-esri-style';
//import { ConfigurableStyle } from './vectorStyles'


const esrijsonFormat = new EsriJSON();

export const generate = (data, core) => {
    let layers = data.config.value.endpoints.map(endpoint => {
    //The random adds a random value to the parameter
    //essentially cache busting
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

    endpoint.styleCache = {};
    //TODO: Use the configurable style function to create the style function
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
          createStyleFunction(meta, core.getMap().getView().getProjection()).then(styleFunction => {
            getLogger()("Debug stuff here");
            endpoint.styleFunction = (feature, resolution) => {
              getLogger()(feature);
              return styleFunction(feature, resolution);
            }

            getLogger()("Setting FN");
            endpoint.layerRef.setStyle(endpoint.styleFunction);
          }, core.getMap().getView().getProjection())
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
        


      })
      .catch(a => {
          getWarning()("Unable to get style from provided URL", endpoint.url, a. endpoint)
          endpoint.styleCache = false;
      });



    let source = new VectorSource({
      loader: function (extent, resolution, projection) {
        let outfields = endpoint.outfields ? endpoint.outfields.join(",") : "*";
        let url =
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
              let features = esrijsonFormat.readFeatures(txt, {
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

    if(endpoint.hasOwnProperty("zoom") && endpoint.zoom.hasOwnProperty("min")) {
      lyr.setMinZoom(endpoint.zoom.min);
    }

    if(endpoint.hasOwnProperty("zoom") && endpoint.zoom.hasOwnProperty("max")) {
      lyr.setMaxZoom(endpoint.zoom.max);
    }

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

          let def = {};
          let conditions = [];
          layer.values.forEach(value => {
            if (value.applied && value.filter && value.filter.all && value.filter.all.length > 0) {
              let indiConds = [];
              value.filter.all.forEach(condition => {

                if (condition.values.exact) {
                  indiConds.push("( " + condition.field + " = '" + condition.values.exact + "' )")
                } else if (condition.values.range) {
                  indiConds.push("( " + condition.field + " > '" + condition.values.greaterThan + "' AND " + condition.field + " < '" + condition.values.lessThan + "')")
                }

              })

              let finalCond = "(" + indiConds.join(" AND ") + ")";
              conditions.push(finalCond);
            }
          });

          let finalFilter = "";
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
        let def = {};
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
    lyr.setVisible(false);
    endpoint.layerRef = lyr;
    return lyr;
  });

  let foo = layers.map(a=>a);

  return layers;
};