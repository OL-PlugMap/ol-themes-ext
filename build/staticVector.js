import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { _styleFunction } from './vectorStyles.js';

const generate = (data, core) => {
  let layers = data.config.value.endpoints.map((endpoint) => {
    let source = new VectorSource({
      maxZoom: 15
    });
    source.highlightFeats = {};
    let vLayer = new VectorLayer({
      declutter: true,
      source,
      zIndex: endpoint.zIndex || 1e3
    });
    vLayer.style = _styleFunction(endpoint, source, vLayer);
    vLayer.setStyle(_styleFunction(endpoint, source, vLayer));
    vLayer.set("id", data.key);
    vLayer.addGeoJSON = (geoJSON) => {
      if (typeof geoJSON === "string") {
        geoJSON = JSON.parse(geoJSON);
      }
      if (geoJSON.type !== "FeatureCollection") {
        geoJSON = { type: "FeatureCollection", features: [geoJSON] };
      }
      source.addFeatures(source.getFormat().readFeatures(geoJSON));
    };
    return vLayer;
  });
  return layers;
};
class StaticVectorConfigBuilder {
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
   * Set the opacity for the layers.
   * @param {number} opacity
   */
  setOpacity(opacity) {
    this._config.opacity = opacity;
    return this;
  }
  /**
   * Add an endpoint configuration with validation.
   * @param {Object} endpoint
   * @param {number} [endpoint.zIndex] - Optional z-index for the layer.
   * @param {Function|Object} [endpoint.style] - Optional static or dynamic style.
   * @throws {Error} If required parameters are invalid.
   */
  addEndpoint(endpoint) {
    if (!endpoint || typeof endpoint !== "object") {
      throw new Error("Endpoint must be an object.");
    }
    if (endpoint.zIndex && typeof endpoint.zIndex !== "number") {
      throw new Error('Endpoint "zIndex" must be a number if provided.');
    }
    this._config.config.value.endpoints.push(endpoint);
    return this;
  }
  /**
   * Build and return the configuration object.
   * @returns {Object}
   */
  build() {
    return this._config;
  }
}

export { StaticVectorConfigBuilder, generate };
//# sourceMappingURL=staticVector.js.map
