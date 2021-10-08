
import { Tile as TileLayer } from "ol/layer.js";
import { TileArcGISRest } from "ol/source";
import TileGrid from "ol/tilegrid/TileGrid"

import {getLogger} from './logger'
import { get } from "ol/proj";
import { getWidth } from "ol/extent";






export const generate = (data,core) => {
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

    let source = new TileArcGISRest({
      crossOrigin: 'anonymous',
      ratio: 1,
      maxZoom: 26,
      tileLoadFunction: (image, src) => {
        image.getImage().src = src;
      },
      tileGrid: tileGrid
      // tileGrid: new TileGrid(
      //     { tileSize:[2048,2048]
      //       , resolutions:[]

      //       , extent: data.config.value.extent
      //     }
      //     )
    });


    let lyr = new TileLayer({
      visible: false,
      preload: 4,
      zIndex: endpoint.zIndex || 0,
      opacity: data.opacity || 1,
      source: source,
      extent: data.config.value.extent
    });
    lyr.set('id', data.key);

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
    else {
      source.setUrl(endpoint.url);
      source.params_ = customParams;
    }
    return lyr;
  });

  return layers;
};