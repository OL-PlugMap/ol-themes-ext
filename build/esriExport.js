import { Tile } from 'ol/layer.js';
import { TileArcGISRest } from 'ol/source';
import TileGrid from 'ol/tilegrid/TileGrid';
import { getLogger } from './logger.js';
import { get } from 'ol/proj';
import { getWidth } from 'ol/extent';
import { _buildEngine } from './filterEngine.js';

const generate = (data, core) => {
  let layers = data.config.value.endpoints.map((endpoint) => {
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
      customParams["layerDefs"] = data.config.value.layerDefs;
    }
    var projExtent = get("EPSG:3857").getExtent();
    var startResolution = getWidth(projExtent) / 256;
    var resolutions = new Array(22);
    for (var i = 0, ii = resolutions.length; i < ii; ++i) {
      resolutions[i] = startResolution / Math.pow(2, i);
    }
    var tileGrid = new TileGrid({
      extent: [-13884991, 2870341, -7455066, 6338219],
      resolutions,
      tileSize: [256, 256]
    });
    let source = new TileArcGISRest({
      crossOrigin: "anonymous",
      ratio: 1,
      maxZoom: 26,
      tileGrid,
      duration: 0
      // tileGrid: new TileGrid(
      //     { tileSize:[2048,2048]
      //       , resolutions:[]
      //       , extent: data.config.value.extent
      //     }
      //     )
    });
    source.setTileLoadFunction((image, src) => {
      if (source.filterSet) {
        getLogger()("Filter set", source.filterSet);
        if (source.filterSet.mode != "NONE") {
          let condStr = "";
          let conds = [];
          let keys = Object.keys(source.filterSet.values);
          if (!keys.length)
            value = true;
          for (let field of keys) {
            let filter = source.filterSet.values[field];
            getLogger()("Checking", field, filter);
            if (filter.any)
              conds.push(`${field} = ANY(${filter.values.map((a) => "'" + a + "'").join(",")})`);
            else if (filter.all) {
              conds.push(`${field} = ALL(${filter.values.map((a) => "'" + a + "'").join(",")})`);
            } else if (filter.contains)
              conds.push(`${field} LIKE '%${filter.values}%'`);
            else if (filter.containsAny)
              conds.push(filter.values.map((a) => `${field} LIKE '%${a}%'`).join(" OR "));
            else if (filter.containsAll)
              conds.push(filter.values.map((a) => `${field} LIKE '%${a}%'`).join(" AND "));
            else if (filter.exactly)
              conds.push(`${field} = '${filter.values}'`);
            getLogger()("Conds is now", conds);
          }
          conds = conds.map((a) => `(${a})`);
          if (source.filterSet.mode == "AND")
            condStr = conds.join(" AND ");
          if (source.filterSet.mode == "OR")
            condStr = conds.join(" OR ");
          if (source.filterSet.layer != null)
            condStr = source.filterSet.layer + ":" + condStr;
          else
            condStr = "all:" + condStr;
          getLogger()("Final where clause", condStr);
          image.getImage().src = src + `&layerDefs=${encodeURIComponent(condStr)}`;
          return;
        }
      } else
        getLogger()("No Filters", source);
      image.getImage().src = src;
    });
    let lyr = new Tile({
      visible: false,
      preload: 4,
      zIndex: endpoint.zIndex || 0,
      opacity: data.opacity || 1,
      source,
      extent: data.config.value.extent
    });
    lyr.set("id", data.key);
    source.applyFilters = function(ls) {
      getLogger()("Applying filters to ", ls);
      if (!Array.isArray(ls) && ls.filts)
        ls = ls.filts;
      ls.forEach((layer) => {
        var def = {};
        var conditions = [];
        layer.values.forEach((value2) => {
          if (value2.applied && value2.filter && value2.filter.all && value2.filter.all.length > 0) {
            var indiConds = [];
            value2.filter.all.forEach((condition) => {
              if (condition.values.exact) {
                indiConds.push("( " + condition.field + " = '" + condition.values.exact + "' )");
              } else if (condition.values.range) {
                indiConds.push("( " + condition.field + " > '" + condition.values.greaterThan + "' AND " + condition.field + " < '" + condition.values.lessThan + "')");
              }
            });
            var finalCond = "(" + indiConds.join(" AND ") + ")";
            conditions.push(finalCond);
          }
        });
        var finalFilter = "";
        switch (layer.mode) {
          case "OR":
            finalFilter = conditions.join(" OR ");
            break;
          case "AND":
            finalFilter = conditions.join(" AND ");
            break;
        }
        if (finalFilter.length > 0) {
          def[layer.layerid] = finalFilter;
          def = JSON.stringify(def);
        } else {
          def = "";
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
          } else {
            lyr.setVisible(false);
          }
        }
      });
    };
    source.oldChanged = source.changed;
    source.changed = () => {
      source.oldChanged();
    };
    lyr.filter = _buildEngine(source);
    source.clearFilters = function(layer) {
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
    };
    let configureSource = function(tokenKey) {
      if (core.services && core.services[tokenKey]) {
        let tokenData = core.services[tokenKey];
        source.setUrl(`${tokenData.baseUrl || ""}${endpoint.url}`);
        if (tokenData.token) {
          customParams["token"] = tokenData.token;
        }
        source.params_ = customParams;
      }
    };
    if (endpoint.tokenKey) {
      if (core.services && core.services[endpoint.tokenKey]) {
        configureSource(endpoint.tokenKey);
      } else {
        self.pendingConfiguration.push({
          name: data.key,
          fn: configureSource,
          params: [endpoint.tokenKey]
        });
      }
    } else {
      source.setUrl(endpoint.url);
      source.params_ = customParams;
    }
    return lyr;
  });
  return layers;
};
class EsriExportConfigBuilder {
  /**
   * @param {Object} [initialConfig] - Optional initial configuration object.
   */
  constructor(initialConfig = {}) {
    this._config = {
      config: {
        value: {
          endpoints: [],
          ...initialConfig.config && initialConfig.config.value ? initialConfig.config.value : {}
        }
      },
      key: initialConfig.key || "",
      opacity: typeof initialConfig.opacity === "number" ? initialConfig.opacity : 1
    };
    if (initialConfig.config && initialConfig.config.value && Array.isArray(initialConfig.config.value.endpoints)) {
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
  setName(name) {
    this._config.name = name;
    return this;
  }
  setZIndex(zIndex) {
    this._config.zIndex = zIndex;
    return this;
  }
  setHidden(hidden) {
    this._config.hidden = hidden;
    return this;
  }
  setLayerId(layerId) {
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
    if (!endpoint || typeof endpoint !== "object") {
      throw new Error("Endpoint must be an object.");
    }
    if (!endpoint.url || typeof endpoint.url !== "string") {
      throw new Error('Endpoint "url" is required and must be a string.');
    }
    if (endpoint.bbox && typeof endpoint.bbox !== "string") {
      throw new Error('Endpoint "bbox" must be a string if provided.');
    }
    if (endpoint.layersToShow && typeof endpoint.layersToShow !== "string") {
      throw new Error('Endpoint "layersToShow" must be a string if provided.');
    }
    if (endpoint.zIndex && typeof endpoint.zIndex !== "number") {
      throw new Error('Endpoint "zIndex" must be a number if provided.');
    }
    if (endpoint.tokenKey && typeof endpoint.tokenKey !== "string") {
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
        layerDefs: this._config.config.value.layerDefs || {}
      }
    };
  }
}
class EsriExportEndpointConfigBuilder {
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
    if (!this._endpoint.url || typeof this._endpoint.url !== "string") {
      throw new Error('Endpoint "url" is required and must be a string.');
    }
    if (this._endpoint.bbox && typeof this._endpoint.bbox !== "string") {
      throw new Error('Endpoint "bbox" must be a string if provided.');
    }
    if (this._endpoint.layersToShow && typeof this._endpoint.layersToShow !== "string") {
      throw new Error('Endpoint "layersToShow" must be a string if provided.');
    }
    if (this._endpoint.zIndex && typeof this._endpoint.zIndex !== "number") {
      throw new Error('Endpoint "zIndex" must be a number if provided.');
    }
    if (this._endpoint.tokenKey && typeof this._endpoint.tokenKey !== "string") {
      throw new Error('Endpoint "tokenKey" must be a string if provided.');
    }
    return { ...this._endpoint };
  }
}

export { EsriExportConfigBuilder, EsriExportEndpointConfigBuilder, generate };
//# sourceMappingURL=esriExport.js.map
