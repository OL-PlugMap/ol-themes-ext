import { Tile as TileLayer } from "ol/layer.js";
import { TileArcGISRest } from "ol/source";
import TileGrid from "ol/tilegrid/TileGrid"

import {getLogger} from './logger'
import { get } from "ol/proj";
import { getWidth } from "ol/extent";

import { _buildEngine } from './filterEngine'






/**
 * Generates OpenLayers TileLayer instances for ArcGIS REST endpoints with optional filtering and authentication.
 *
 * @param {Object} data - The configuration object for the export.
 * @param {Object} data.config - The configuration details.
 * @param {Object} data.config.value - The main config values.
 * @param {Array}  data.config.value.endpoints - Array of endpoint objects to generate layers for.
 * @param {string} data.key - Unique identifier for the layer group.
 * @param {number} [data.opacity=1] - Opacity for the layers (default: 1).
 * @param {Object} core - Core context object, typically containing authentication and service info.
 * @param {Object} [core.services] - Optional. Service tokens and base URLs keyed by tokenKey.
 * @returns {Array} Array of OpenLayers TileLayer instances, one for each endpoint.
 *
 * Each endpoint object in `data.config.value.endpoints` can have:
 *   - url {string}: ArcGIS REST endpoint URL.
 *   - bbox {string}: Optional. Bounding box for the request.
 *   - layersToShow {string}: Optional. Comma-separated list of layer IDs to show.
 *   - zIndex {number}: Optional. z-index for the layer.
 *   - tokenKey {string}: Optional. Key to look up authentication info in core.services.
 */
export const generate = (data,core) => {
    let layers = data.config.value.endpoints.map(endpoint => {
    //The random adds a random value to the parameter
    //essentually cache busting  
    let customParams = {
      get random() {
        return data.config.value.cacheBust ? Math.random() : null;
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
      tileGrid: tileGrid,
      duration: 0
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
      //source.tileCache.clear();
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

/**
 * Helper class to build configuration objects for the `generate` function.
 *
 * Example usage:
 *   const config = new EsriExportConfigBuilder()
 *     .setKey('myLayerGroup')
 *     .setOpacity(0.8)
 *     .setExtent([-13884991, 2870341, -7455066, 6338219])
 *     .addEndpoint({
 *       url: 'https://example.com/arcgis/rest/services/Layer/MapServer/export',
 *       bbox: '...',
 *       layersToShow: '0,1,2',
 *       zIndex: 2,
 *       tokenKey: 'myToken'
 *     })
 *     .build();
 */
export class EsriExportConfigBuilder {
  /**
   * @param {Object} [initialConfig] - Optional initial configuration object.
   */
  constructor(initialConfig = {}) {
    this._config = {
      config: {
        value: {
          endpoints: [],
          ...(initialConfig.config && initialConfig.config.value ? initialConfig.config.value : {})
        },
      },
      key: initialConfig.key || '',
      opacity: typeof initialConfig.opacity === 'number' ? initialConfig.opacity : 1,
    };

    // If endpoints are provided, ensure it's an array
    if (
      initialConfig.config &&
      initialConfig.config.value &&
      Array.isArray(initialConfig.config.value.endpoints)
    ) {
      this._config.config.value.endpoints = [...initialConfig.config.value.endpoints];
    }
  }

  /**
   * Set the unique key for the layer group.
   * @param {string} key
   */
  setKey(key) {
    this._config.key = key;
    return this;
  }

  setName (name) {
    this._config.name = name;
    return this;
  }

  setZIndex (zIndex) {
    this._config.zIndex = zIndex;
    return this;
  }

  setHidden (hidden) {
    this._config.hidden = hidden;
    return this;
  }

  setLayerId (layerId) {
    this._config.layerId = layerId;
    return this;
  }

  /**
   * Set the opacity for the layers.
   * @param {number} opacity
   */
  setOpacity(opacity) {
    this._config.opacity = opacity;
    return this;
  }

  /**
   * Set the extent for the layers.
   * @param {Array<number>} extent
   */
  setExtent(extent) {
    this._config.config.value.extent = extent;
    return this;
  }

  /**
   * Set the layerDefs for the layers.
   * @param {Object|string} layerDefs
   */
  setLayerDefs(layerDefs) {
    this._config.config.value.layerDefs = layerDefs;
    return this;
  }

  /**
   * Add an endpoint configuration with validation.
   * @param {Object} endpoint
   * @param {string} endpoint.url - ArcGIS REST endpoint URL. (required)
   * @param {string} [endpoint.bbox] - Optional bounding box.
   * @param {string} [endpoint.layersToShow] - Optional comma-separated list of layer IDs.
   * @param {number} [endpoint.zIndex] - Optional z-index.
   * @param {string} [endpoint.tokenKey] - Optional token key for authentication.
   * @throws {Error} If required parameters are missing or invalid.
   */
  addEndpoint(endpoint) {
    // Validate required fields
    if (!endpoint || typeof endpoint !== 'object') {
      throw new Error('Endpoint must be an object.');
    }
    if (!endpoint.url || typeof endpoint.url !== 'string') {
      throw new Error('Endpoint "url" is required and must be a string.');
    }
    // Optional: Validate types of optional fields
    if (endpoint.bbox && typeof endpoint.bbox !== 'string') {
      throw new Error('Endpoint "bbox" must be a string if provided.');
    }
    if (endpoint.layersToShow && typeof endpoint.layersToShow !== 'string') {
      throw new Error('Endpoint "layersToShow" must be a string if provided.');
    }
    if (endpoint.zIndex && typeof endpoint.zIndex !== 'number') {
      throw new Error('Endpoint "zIndex" must be a number if provided.');
    }
    if (endpoint.tokenKey && typeof endpoint.tokenKey !== 'string') {
      throw new Error('Endpoint "tokenKey" must be a string if provided.');
    }

    this._config.config.value.endpoints.push(endpoint);
    return this;
  }

  /**
   * Build and return the configuration object.
   * @returns {Object}
   */
  buildRaw() {
    return this._config;
  }

  build() {
    return {
      key: this._config.key,
      name: this._config.name,
      zIndex: this._config.zIndex,
      hidden: this._config.hidden,
      layerId: this._config.layerId,
      opacity: this._config.opacity,
      esriExport: {
        endpoints: this._config.config.value.endpoints,
        extent: this._config.config.value.extent || [-13884991, 2870341, -7455066, 6338219],
        layerDefs: this._config.config.value.layerDefs || {},

      }
    };
  }
}

/**
 * Builder for a single endpoint configuration.
 *
 * Example usage:
 *   const endpoint = new EsriExportEndpointConfigBuilder({ url: '...' })
 *     .setBbox('...')
 *     .setLayersToShow('0,1,2')
 *     .setZIndex(2)
 *     .setTokenKey('myToken')
 *     .build();
 */
export class EsriExportEndpointConfigBuilder {
  /**
   * @param {Object} [initialEndpoint] - Optional initial endpoint configuration.
   */
  constructor(initialEndpoint = {}) {
    this._endpoint = { ...initialEndpoint };
  }

  setUrl(url) {
    this._endpoint.url = url;
    return this;
  }

  setBbox(bbox) {
    this._endpoint.bbox = bbox;
    return this;
  }

  setLayersToShow(layersToShow) {
    this._endpoint.layersToShow = layersToShow;
    return this;
  }

  setZIndex(zIndex) {
    this._endpoint.zIndex = zIndex;
    return this;
  }

  setTokenKey(tokenKey) {
    this._endpoint.tokenKey = tokenKey;
    return this;
  }

  build() {
    if (!this._endpoint.url || typeof this._endpoint.url !== 'string') {
      throw new Error('Endpoint "url" is required and must be a string.');
    }
    if (this._endpoint.bbox && typeof this._endpoint.bbox !== 'string') {
      throw new Error('Endpoint "bbox" must be a string if provided.');
    }
    if (this._endpoint.layersToShow && typeof this._endpoint.layersToShow !== 'string') {
      throw new Error('Endpoint "layersToShow" must be a string if provided.');
    }
    if (this._endpoint.zIndex && typeof this._endpoint.zIndex !== 'number') {
      throw new Error('Endpoint "zIndex" must be a number if provided.');
    }
    if (this._endpoint.tokenKey && typeof this._endpoint.tokenKey !== 'string') {
      throw new Error('Endpoint "tokenKey" must be a string if provided.');
    }
    return { ...this._endpoint };
  }
}