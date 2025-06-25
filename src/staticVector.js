import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';

import { _styleFunction } from './vectorStyles'



/**
 * Generates OpenLayers VectorLayer instances for static vector endpoints.
 *
 * @param {Object} data - The configuration object for the export.
 * @param {Object} data.config - The configuration details.
 * @param {Object} data.config.value - The main config values.
 * @param {Array}  data.config.value.endpoints - Array of endpoint objects to generate layers for.
 * @param {string} data.key - Unique identifier for the layer group.
 * @param {number} [data.opacity=1] - Opacity for the layers (default: 1).
 * @param {Object} core - Core context object, typically containing authentication and service info.
 * @returns {Array} Array of OpenLayers VectorLayer instances, one for each endpoint.
 *
 * Each endpoint object in `data.config.value.endpoints` can have:
 *   - zIndex {number}: Optional. z-index for the layer.
 *   - style {Function|Object}: Optional. Static or dynamic style function/object for the layer.
 */
export const generate = (data, core) => {
    let layers = data.config.value.endpoints.map(endpoint => {
        
        let source = new VectorSource({
          maxZoom: 15,
        });

        source.highlightFeats = {};


        let vLayer = new VectorLayer({
          declutter: true,
          source: source,
          zIndex: endpoint.zIndex || 1000
        });

        vLayer.style = _styleFunction(endpoint, source, vLayer);
        vLayer.setStyle(_styleFunction(endpoint, source, vLayer))

        vLayer.set('id', data.key);

        vLayer.addGeoJSON = (geoJSON) => {
          if (typeof geoJSON === 'string') {
            geoJSON = JSON.parse(geoJSON);
          }
          if (geoJSON.type !== 'FeatureCollection') {
            geoJSON = { type: 'FeatureCollection', features: [geoJSON] };
          }
          source.addFeatures(source.getFormat().readFeatures(geoJSON));
        }
        
        return vLayer;
      });

    return layers;
}

/**
 * Builder for the static vector configuration object.
 *
 * Example usage:
 *   const config = new StaticVectorConfigBuilder()
 *     .setKey('myLayerGroup')
 *     .setOpacity(0.8)
 *     .addEndpoint({
 *       zIndex: 2,
 *       style: myStyleFunction // or a static style object
 *     })
 *     .build();
 */
export class StaticVectorConfigBuilder {
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
    if (!endpoint || typeof endpoint !== 'object') {
      throw new Error('Endpoint must be an object.');
    }
    if (endpoint.zIndex && typeof endpoint.zIndex !== 'number') {
      throw new Error('Endpoint "zIndex" must be a number if provided.');
    }
    // style can be a function or an object, so no strict validation

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