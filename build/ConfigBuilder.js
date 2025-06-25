export { EsriExportConfigBuilder, EsriExportEndpointConfigBuilder } from './esriExport.js';
export { StaticVectorConfigBuilder } from './staticVector.js';
export { EsriFeatureConfigBuilder, EsriFeatureEndpointConfigBuilder } from './esriFeature.js';

class XYZConfigBuilder {
  /**
   * @param {Object} [initialConfig] - Optional initial configuration object.
   */
  constructor(initialConfig = {}) {
    this._config = {
      key: initialConfig.key || "",
      name: initialConfig.name || "",
      opacity: typeof initialConfig.opacity === "number" ? initialConfig.opacity : 1,
      config: {
        type: "xyz",
        value: {
          endpoints: [],
          maxZoom: typeof initialConfig.maxZoom === "number" ? initialConfig.maxZoom : 26,
          minZoom: typeof initialConfig.minZoom === "number" ? initialConfig.minZoom : 1,
          ...initialConfig.config && initialConfig.config.value ? initialConfig.config.value : {}
        }
      }
    };
    if (initialConfig.config && initialConfig.config.value && Array.isArray(initialConfig.config.value.endpoints)) {
      this._config.config.value.endpoints = [...initialConfig.config.value.endpoints];
    }
  }
  setKey(key) {
    this._config.key = key;
    return this;
  }
  setName(name) {
    this._config.name = name;
    return this;
  }
  setOpacity(opacity) {
    this._config.opacity = opacity;
    return this;
  }
  setMaxZoom(maxZoom) {
    this._config.config.value.maxZoom = maxZoom;
    return this;
  }
  setMinZoom(minZoom) {
    this._config.config.value.minZoom = minZoom;
    return this;
  }
  /**
   * Add an endpoint configuration.
   * @param {Object} endpoint
   * @param {string} endpoint.url - XYZ tile URL template (required).
   * @param {number} [endpoint.zIndex] - Optional z-index for the layer.
   * @throws {Error} If required parameters are missing or invalid.
   */
  addEndpoint(endpoint) {
    if (!endpoint || typeof endpoint !== "object") {
      throw new Error("Endpoint must be an object.");
    }
    if (!endpoint.url || typeof endpoint.url !== "string") {
      throw new Error('Endpoint "url" is required and must be a string.');
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
    return {
      key: this._config.key,
      name: this._config.name,
      zIndex: this._config.config.value.endpoints[0]?.zIndex || 0,
      hidden: false,
      opacity: this._config.opacity,
      xyz: {
        endpoints: this._config.config.value.endpoints,
        maxZoom: this._config.config.value.maxZoom,
        minZoom: this._config.config.value.minZoom
      }
    };
  }
}
class MapConfigBuilder {
  constructor() {
    this.config = {
      layerCategories: [],
      layerGroups: [],
      layers: []
    };
  }
  /**
   * Adds a new layer category to the configuration.
   *
   * @param {Object} category - The layer category object to add.
   * @returns {ConfigBuilder} Returns the current instance for method chaining.
   */
  addLayerCategory(category) {
    this.config.layerCategories.push(category);
    return this;
  }
  /**
   * Adds a layer group to the configuration.
   *
   * @param {Object} group - The layer group object to add.
   * @returns {ConfigBuilder} The current instance for method chaining.
   */
  addLayerGroup(group) {
    this.config.layerGroups.push(group);
    return this;
  }
  /**
   * Adds one or more layers to the configuration.
   *
   * @param {Object|Object[]} layer - A single layer object or an array of layer objects to add.
   * @returns {ConfigBuilder} Returns the current instance for method chaining.
   */
  addLayer(layer) {
    if (Array.isArray(layer)) {
      this.config.layers.push(...layer);
    } else {
      this.config.layers.push(layer);
    }
    return this;
  }
  /**
   * Builds and returns the current configuration object.
   *
   * @returns {Object} The configuration object.
   */
  build() {
    return this.config;
  }
}
class CategoryConfigBuilder {
  constructor(config = {}) {
    this.config = {
      key: config.key || "",
      name: config.name || "",
      description: config.description || "",
      icon: config.icon || "",
      hidden: typeof config.hidden === "boolean" ? config.hidden : false,
      zIndex: typeof config.zIndex === "number" ? config.zIndex : 0,
      layerGroups: config.layerGroups || [],
      multiphasic: config.multiphasic || false,
      selectiveness: config.selectiveness || "monoselective",
      legend: config.legend || { enabled: false },
      defaultSelection: config.defaultSelection || [],
      opacity: typeof config.opacity === "number" ? config.opacity : 1
    };
  }
  /**
   * Sets the unique key for the category.
   * @param {string} key - The unique key for the category.
   * @returns {CategoryConfigBuilder} Returns the current instance for method chaining.
   */
  setKey(key) {
    this.config.key = key;
    return this;
  }
  /**
   * Sets the name for the category.
   * @param {string} name - The name of the category.
   * @returns {CategoryConfigBuilder} Returns the current instance for method chaining.
   */
  setName(name) {
    this.config.name = name;
    return this;
  }
  /**
   * Sets the description for the category.
   * @param {string} description - The description of the category.
   * @returns {CategoryConfigBuilder} Returns the current instance for method chaining.
   */
  setDescription(description) {
    this.config.description = description;
    return this;
  }
  /**
   * Sets the icon for the category.
   * @param {string} icon - The icon URL or class name for the category.
   * @returns {CategoryConfigBuilder} Returns the current instance for method chaining.
   */
  setIcon(icon) {
    this.config.icon = icon;
    return this;
  }
  /**
   * Sets the visibility of the category.
   * @param {boolean} hidden - Whether the category is hidden.
   * @returns {CategoryConfigBuilder} Returns the current instance for method chaining.
   */
  setHidden(hidden) {
    this.config.hidden = hidden;
    return this;
  }
  /**
   * Sets the z-index for the category.
   * @param {number} zIndex - The z-index for the category.
   * @returns {CategoryConfigBuilder} Returns the current instance for method chaining.
   */
  setZIndex(zIndex) {
    this.config.zIndex = zIndex;
    return this;
  }
  /**
   * Adds a layer group to the category.
   * @param {Object} layer - The layer object to add.
   * @returns {CategoryConfigBuilder} Returns the current instance for method chaining.
   */
  addLayerGroup(layerGroup) {
    this.config.layerGroups.push(layerGroup);
    return this;
  }
  /**
   * Sets whether the category is multiphasic.
   * @param {boolean} multiphasic - Whether the category is multiphasic.
   * @returns {CategoryConfigBuilder} Returns the current instance for method chaining.
   */
  setMultiphasic() {
    this.config.multiphasic = true;
    return this;
  }
  /**
   * Sets the selectiveness of the category.
   * @param {string} selectiveness - The selectiveness type ('monoselective' or 'multiselective').
   * @returns {CategoryConfigBuilder} Returns the current instance for method chaining.
   */
  setSelectiveness(selectiveness) {
    const validSelectiveness = ["monoselective", "polyselective"];
    if (!validSelectiveness.includes(selectiveness)) {
      throw new Error(`Selectiveness must be one of: ${validSelectiveness.join(", ")}`);
    }
    this.config.selectiveness = selectiveness;
    return this;
  }
  /**
   * Sets the opacity for the category.
   * @param {number} opacity - The opacity value (0 to 1).
   * @returns {CategoryConfigBuilder} Returns the current instance for method chaining.
   * */
  setOpacity(opacity) {
    if (typeof opacity !== "number" || opacity < 0 || opacity > 1) {
      throw new Error("Opacity must be a number between 0 and 1.");
    }
    this.config.opacity = opacity;
    return this;
  }
  /**
   * Sets the default selection for the category.
   * @param {Array} defaultSelection - An array of layer keys that should be selected by default.
   * @return {CategoryConfigBuilder} Returns the current instance for method chaining.
   */
  setDefaultSelection(defaultSelection) {
    if (!Array.isArray(defaultSelection)) {
      throw new Error("Default selection must be an array.");
    }
    this.config.defaultSelection = defaultSelection;
    return this;
  }
  /**
   * Sets the legend configuration for the category.
   * @param {Object} legend - The legend configuration object.
   * @returns {CategoryConfigBuilder} Returns the current instance for method chaining.
   */
  setLegend(legend) {
    if (typeof legend !== "object" || legend === null) {
      throw new Error("Legend must be an object.");
    }
    this.config.legend = legend;
    return this;
  }
  /**
   * Builds and returns the category configuration object.
   * @returns {Object} The category configuration object.
   */
  build() {
    return {
      key: this.config.key,
      name: this.config.name,
      description: this.config.description,
      icon: this.config.icon,
      hidden: this.config.hidden,
      zIndex: this.config.zIndex,
      layerGroups: this.config.layerGroups,
      multiphasic: this.config.multiphasic,
      selectiveness: this.config.selectiveness,
      legend: this.config.legend,
      defaultSelection: this.config.defaultSelection,
      opacity: this.config.opacity
    };
  }
}

export { CategoryConfigBuilder, MapConfigBuilder, XYZConfigBuilder };
//# sourceMappingURL=ConfigBuilder.js.map
