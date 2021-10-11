
import { Tile as TileLayer } from "ol/layer.js";
import { TileArcGISRest } from "ol/source";
import TileGrid from "ol/tilegrid/TileGrid"

import {getLogger} from './logger'
import { get } from "ol/proj";
import { getWidth } from "ol/extent";

import { _buildEngine } from './filterEngine'






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
      tileGrid: tileGrid
      // tileGrid: new TileGrid(
      //     { tileSize:[2048,2048]
      //       , resolutions:[]

      //       , extent: data.config.value.extent
      //     }
      //     )
    });

    source.setTileLoadFunction((image, src) => {
      if(source.filterSet)
      {
        getLogger()("Filter set", source.filterSet);
        if(source.filterSet.mode != "NONE")
        {
          let condStr = "";
          let conds = [];


          let keys = Object.keys(source.filterSet.values);

          if(!keys.length)
              value = true;

          for(let field of keys)
          {
              
              let filter = source.filterSet.values[field];

              getLogger()("Checking", field, filter);

              if(filter.any)
                  conds.push(`${field} = ANY(${filter.values.map(a=>"'"+a+"'").join(",")})`);
              else if(filter.all)
              {
                conds.push(`${field} = ALL(${filter.values.map(a=>"'"+a+"'").join(",")})`);
              }
              else if(filter.contains)
                conds.push(`${field} LIKE '%${filter.values}%'`);
              else if(filter.containsAny)
                conds.push(filter.values.map(a => `${field} LIKE '%${a}%'`).join(" OR "));
              else if(filter.containsAll)
                conds.push(filter.values.map(a => `${field} LIKE '%${a}%'`).join(" AND "));                
              else if(filter.exactly)
                conds.push(`${field} = '${filter.values}'`);

              getLogger()("Conds is now", conds)
          }

          conds = conds.map(a => `(${a})`);
                        
          if(source.filterSet.mode == "AND")
              condStr = conds.join(" AND ");
          if(source.filterSet.mode == "OR")
            condStr = conds.join(" OR ");


          if(source.filterSet.layer != null)
            condStr = source.filterSet.layer + ":" + condStr;
          else
            condStr = "all:" + condStr; //TODO: I am unsure if this is even valid

          getLogger()("Final where clause", condStr);

          image.getImage().src = src + `&layerDefs=${encodeURIComponent(condStr)}`;
          return;

        }
      }
      else
        getLogger()("No Filters", source);

      image.getImage().src = src;
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
        getLogger()("Applying filters to ", ls);
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

    source.oldChanged = source.changed;
    
    //This is a hack because calling changed wont clear the tile cache automatically
    source.changed = () => {
      source.tileCache.clear();
      source.oldChanged();
    }

    lyr.filter = _buildEngine(source, lyr);

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