import TileGrid from 'ol/tilegrid/TileGrid';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { createXYZ } from 'ol/tilegrid';
import { Style, Stroke, Fill } from 'ol/style';
import EsriJSON from 'ol/format/EsriJSON';
import { get } from 'ol/proj';
import { getWidth } from 'ol/extent';
import { tile } from 'ol/loadingstrategy';
import { getLogger, getWarning } from './logger.js';
import { createStyleFunction } from 'ol-esri-style-10';

const esrijsonFormat = new EsriJSON();
const generate = (data, core) => {
  let layers = data.config.value.endpoints.map((endpoint) => {
    if (endpoint.bbox) {
      endpoint.bbox;
    }
    if (endpoint.layersToShow) {
      endpoint.layersToShow;
    }
    if (data.config.value.layerDefs) {
      data.config.value.layerDefs;
    }
    var projExtent = get("EPSG:3857").getExtent();
    var startResolution = getWidth(projExtent) / 256;
    var resolutions = new Array(22);
    for (var i = 0, ii = resolutions.length; i < ii; ++i) {
      resolutions[i] = startResolution / Math.pow(2, i);
    }
    new TileGrid({
      extent: [-13884991, 2870341, -7455066, 6338219],
      resolutions,
      tileSize: [256, 256]
    });
    endpoint.styleCache = {};
    endpoint.styleFunction = function(feature) {
      if (!endpoint.styleCache) {
        return new Style({
          fill: new Fill({
            color: "rgba(255,0,0,0.5)"
          }),
          stroke: new Stroke({
            color: "rgba(255,0,255,0.75)",
            width: 4
          })
        });
      } else {
        if (feature.get(endpoint.styleCache.field)) {
          if (endpoint.styleCache.map[feature.get(endpoint.styleCache.field)]) {
            return endpoint.styleCache.map[feature.get(endpoint.styleCache.field)];
          } else {
            getLogger()("Cant find mapped value for " + feature.get(endpoint.styleCache.field));
            return new Style({
              fill: new Fill({
                color: "rgba(255,0,0,0.5)"
              }),
              stroke: new Stroke({
                color: "rgba(255,0,255,0.75)",
                width: 4
              })
            });
          }
        }
      }
    };
    if (!endpoint.style) {
      window.fetch(endpoint.url + "?f=json").then((resp) => {
        return resp.json();
      }).then((meta) => {
        try {
          getLogger()("Style", meta);
          console.log("Metadata", meta);
          createStyleFunction(meta).then((styleFunction) => {
            getLogger()("Debug stuff here");
            endpoint.styleFunction = (feature, resolution) => {
              getLogger()(feature);
              return styleFunction(feature, resolution);
            };
            getLogger()("Setting FN");
            endpoint.layerRef.setStyle(endpoint.styleFunction);
          }).catch((err) => {
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
              });
            };
            getLogger()("Setting FN");
            endpoint.layerRef.setStyle(endpoint.styleFunction);
          });
        } catch (ex) {
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
            });
          };
          getLogger()("Setting FN");
          endpoint.layerRef.setStyle(endpoint.styleFunction);
        }
      }).catch((a) => {
        getWarning()("Unable to get style from provided URL", endpoint.url, a.endpoint);
        endpoint.styleCache = false;
      });
    }
    let source = new VectorSource({
      loader: function(extent, resolution, projection) {
        let outfields = endpoint.outfields ? endpoint.outfields.join(",") : "*";
        var url = endpoint.url + "/query/?f=json&returnGeometry=true&spatialRel=esriSpatialRelIntersects&geometry=" + encodeURIComponent(
          '{"xmin":' + extent[0] + ',"ymin":' + extent[1] + ',"xmax":' + extent[2] + ',"ymax":' + extent[3] + ',"spatialReference":{"wkid":102100}}'
        ) + "&geometryType=esriGeometryEnvelope&inSR=102100&outFields=" + outfields;
        window.fetch(url).then((response) => {
          return response.text();
        }).then(
          (txt) => {
            var features = esrijsonFormat.readFeatures(txt, {
              featureProjection: projection
            });
            if (features.length > 0) {
              source.addFeatures(features);
            }
          }
        ).catch((err) => {
          getWarning()("Unhandled exception in esri feature loader", err);
        });
      },
      strategy: tile(
        createXYZ({
          tileSize: 512
        })
      )
    });
    endpoint.style || {};
    let lyr = new VectorLayer({
      source,
      zIndex: endpoint.zIndex || 0,
      opacity: data.opacity || 1,
      style: endpoint.styleFunction
    });
    lyr.set("id", data.key);
    source.applyFilters = function(ls) {
      if (!Array.isArray(ls) && ls.filts)
        ls = ls.filts;
      ls.forEach((layer) => {
        var def = {};
        var conditions = [];
        layer.values.forEach((value) => {
          if (value.applied && value.filter && value.filter.all && value.filter.all.length > 0) {
            var indiConds = [];
            value.filter.all.forEach((condition) => {
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
    lyr.setVisible(false);
    endpoint.layerRef = lyr;
    return lyr;
  });
  return layers;
};
class EsriFeatureConfigBuilder {
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
  /**
   * Set the opacity for the layer group.
   * @param {number} opacity
   * @throws {Error} If opacity is not a number between 0 and 1.
   * @returns {EsriFeatureConfigBuilder} Returns the builder instance for chaining.
   */
  setOpacity(opacity) {
    if (typeof opacity !== "number" || opacity < 0 || opacity > 1) {
      throw new Error("Opacity must be a number between 0 and 1.");
    }
    this._config.opacity = opacity;
    return this;
  }
  /**
   * Sets the name of the layer group.
   * @param {string} name
   * @returns {EsriFeatureConfigBuilder} Returns the builder instance for chaining.
   */
  setName(name) {
    this._config.name = name;
    return this;
  }
  /**
   * Set the z-index for the layer group.
   * @param {number} zIndex
   * @throws {Error} If zIndex is not a number.
   * @returns {EsriFeatureConfigBuilder} Returns the builder instance for chaining.
   * */
  setZIndex(zIndex) {
    if (typeof zIndex !== "number") {
      throw new Error("Z-index must be a number.");
    }
    this._config.zIndex = zIndex;
    return this;
  }
  /**
   * Set whether the layer group is hidden.
   * @param {*} hidden 
   * @returns 
   */
  setHidden(hidden) {
    if (typeof hidden !== "boolean") {
      throw new Error("Hidden must be a boolean value.");
    }
    this._config.hidden = hidden;
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
   * @param {Function|Object} [endpoint.style] - Optional static or dynamic style.
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
  build() {
    return {
      key: this._config.key,
      opacity: this._config.opacity,
      name: this._config.name || this._config.key,
      zIndex: this._config.zIndex || 0,
      hidden: this._config.hidden || false,
      extent: this._config.config.value.extent || [-13884991, 2870341, -7455066, 6338219],
      esriFeature: this._config.config.value
    };
  }
}
class EsriFeatureEndpointConfigBuilder {
  /**
   * @param {Object} [initialEndpoint] - Optional initial endpoint configuration.
   */
  constructor(initialEndpoint = {}) {
    this._endpoint = { ...initialEndpoint };
  }
  /**
   * Set the ArcGIS REST endpoint URL (required).
   * @param {string} url
   */
  setUrl(url) {
    this._endpoint.url = url;
    return this;
  }
  /**
   * Set the bounding box (optional).
   * @param {string} bbox
   */
  setBbox(bbox) {
    this._endpoint.bbox = bbox;
    return this;
  }
  /**
   * Set the comma-separated list of layer IDs to show (optional).
   * @param {string} layersToShow
   */
  setLayersToShow(layersToShow) {
    this._endpoint.layersToShow = layersToShow;
    return this;
  }
  /**
   * Set the z-index for the layer (optional).
   * @param {number} zIndex
   */
  setZIndex(zIndex) {
    this._endpoint.zIndex = zIndex;
    return this;
  }
  /**
   * Set the token key for authentication (optional).
   * @param {string} tokenKey
   */
  setTokenKey(tokenKey) {
    this._endpoint.tokenKey = tokenKey;
    return this;
  }
  /**
   * Set a static or dynamic style (optional).
   * @param {Function|Object} style
   */
  setStyle(style) {
    this._endpoint.style = style;
    return this;
  }
  /**
   * Build and return the endpoint configuration object.
   * @returns {Object}
   * @throws {Error} If required parameters are missing or invalid.
   */
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

export { EsriFeatureConfigBuilder, EsriFeatureEndpointConfigBuilder, generate };
//# sourceMappingURL=esriFeature.js.map
