import FillPattern from 'ol-ext/style/FillPattern';
import { Circle, Stroke, Fill, Style, Text } from 'ol/style';
import { _checkFilter } from './filterEngine.js';
import { getLogger } from './logger.js';

class ConfigurableStyleEngine {
  constructor() {
    this.highlightStyleConf = {
      fill: new Fill({ color: "rgba(255,255,100,0.7)" }),
      stroke: new Stroke({ color: "rgba(255,255,0,1)", width: 1 }),
      image: new Circle({ radius: 10, stroke: new Stroke({ color: "#fff" }), fill: new Fill({ color: "#3399CC" }) }),
      zIndex: 999
    };
    this.invisibleStyleConf = {
      fill: new Fill({ color: "rgba(255,255,255,0.0)" }),
      stroke: new Stroke({ color: "rgba(255,255,255,0.0)", width: 1 })
    };
    this.highlightStyle = new Style(this.highlightStyleConf);
    this.invisibleStyle = new Style(this.invisibleStyleConf);
    this.selectedStyleConf = {
      fill: new Fill({
        color: "rgba(255,255,100,0.7)"
      }),
      stroke: new Stroke({
        color: "rgba(255,255,0,1)",
        width: 1
      })
    };
    this.selectedStyle = new Style(this.selectedStyleConf);
    this.unstyledConf = {
      fill: new Fill({
        color: "rgba(255,255,255,0.5)"
      }),
      stroke: new Stroke({
        color: "rgba(0,0,0,0.75)",
        width: 4
      })
    };
    this.unstyled = new Style(this.unstyledConf);
  }
  /**
   * Creates a FillPattern instance based on the provided style object.
   *
   * @param {Object} style - The style object containing pattern options.
   * @param {Object} style.pattern - The pattern options for FillPattern.
   * @param {string} style.strokeColor - The color to use for the pattern's stroke.
   * @param {string} style.fillColor - The color to use for the pattern's fill.
   * @returns {FillPattern} The generated FillPattern instance.
   */
  pattern(style) {
    let opts = style.pattern;
    opts.color = style.strokeColor;
    opts.fill = new Fill({ color: style.fillColor });
    return new FillPattern(opts);
  }
  /**
   * Determines if a given feature is highlighted in the specified source.
   *
   * @param {Object} source - The source object containing highlighted features.
   * @param {ol.Feature} feature - The OpenLayers feature to check.
   * @returns {boolean} True if the feature is highlighted; otherwise, false.
   */
  featureIsHighlighted(source, feature) {
    return source.highlightFeats[feature.getId()];
  }
  /**
   * Determines whether a given feature should be rendered based on various filter conditions.
   *
   * @param {Object} source - The source object containing filter settings.
   * @param {ol.Feature} feature - The OpenLayers feature to evaluate for rendering.
   * @returns {boolean} True if the feature should be rendered, otherwise false.
   */
  featureShouldBeRendered(source, feature) {
    var renderFeature = true;
    var fev = feature.get("FilterEngine");
    var r = true;
    if (fev && fev.renderFn) {
      fev.renderFn();
      r = fev.render;
    }
    if (source.filterSet && source.filterSet.mode && source.filterSet.mode != "NONE") {
      let isRenderable = _checkFilter(source, feature);
      getLogger()(isRenderable);
      r = isRenderable;
    }
    renderFeature = feature.get("selected") || r;
    return renderFeature;
  }
  /**
   * Generates a dynamic style function for vector features based on endpoint and source configuration.
   *
   * @param {Object} endpoint - The endpoint configuration object, expected to contain style information.
   * @param {Object} source - The source object used for feature highlighting and rendering logic.
   * @returns {function} A function that takes an OpenLayers feature and returns an appropriate style instance.
   *
   * The returned function applies the following logic:
   * - Returns a highlight style if the feature is highlighted.
   * - Checks if the feature should be rendered; if not, returns an invisible style.
   * - Returns a selected style if the feature is marked as selected.
   * - If the feature has the specified dynamic field, applies a style from the dynamic map.
   * - Returns an invisible style if no matching style is found in the map.
   * - Returns an unstyled style as a fallback.
   */
  dynamicStyling(endpoint, source) {
    let that = this;
    return function(feature) {
      if (that.featureIsHighlighted(source, feature)) {
        return that.highlightStyle;
      }
      var renderFeature = this.featureShouldBeRendered(source, feature);
      let map = endpoint.style.dynamic.map;
      let field = endpoint.style.dynamic.field;
      if (!renderFeature) {
        return invisibleStyle;
      } else if (feature.get("selected")) {
        return selectedStyle;
      } else if (feature && (feature.properties_ && feature.properties_[field] || feature.get && feature.get(field))) {
        var val = feature.properties_ ? feature.properties_[field] + "" : feature.get(field) + "";
        if (map[val]) {
          var style = map[val];
          let styleConf2 = this.convertToStyleConf(style);
          return new Style(styleConf2);
        } else {
          return this.invisibleStyle;
        }
      } else {
        return this.unstyled;
      }
    };
  }
  /**
   * Converts a style configuration object into an OpenLayers style configuration.
   *
   * @param {Object} style - The style configuration object.
   * @param {Object} [style.pattern] - Optional pattern fill configuration.
   * @param {string} [style.fillColor] - Fill color in CSS color format (e.g., "rgba(255,0,0,0.5)").
   * @param {string} [style.strokeColor] - Stroke color in CSS color format.
   * @param {number} [style.strokeWidth=4] - Stroke width in pixels.
   * @param {Object} [style.image] - Image style configuration.
   * @param {string} [style.image.type] - Type of image ("circle" or "icon").
   * @param {number} [style.image.radius=10] - Radius for circle image.
   * @param {string} [style.image.strokeColor='#fff'] - Stroke color for circle image.
   * @param {string} [style.image.fillColor='#3399CC'] - Fill color for circle image.
   * @param {string} [style.image.src] - Source URL for icon image.
   * @param {Array<number>} [style.image.anchor=[0.5, 0.5]] - Anchor for icon image.
   * @param {string} [style.image.anchorXUnits='fraction'] - X anchor units for icon image.
   * @param {string} [style.image.anchorYUnits='fraction'] - Y anchor units for icon image.
   * @param {number} [style.image.scale=1] - Scale for icon image.
   * @param {number} [style.image.rotation=0] - Rotation for icon image in radians.
   * @param {number} [style.image.opacity=1] - Opacity for icon image.
   * @param {string} [style.image.color='#000'] - Color for icon image.
   * @param {string} [style.image.crossOrigin='anonymous'] - Cross-origin setting for icon image.
   * @param {Object} [style.text] - Text style configuration.
   * @param {string} [style.text.static] - Static text to display.
   * @param {string} [style.text.font='12px Calibri,sans-serif'] - Font for text.
   * @param {string} [style.text.fillColor='#fff'] - Fill color for text.
   * @returns {Object} styleConf - The OpenLayers style configuration object.
   */
  convertToStyleConf(style) {
    let styleConf = {};
    if (style.pattern) {
      styleConf.fill = pattern(style);
    } else if (style.fillColor) {
      styleConf.fill = new Fill({ color: style.fillColor || "rgba(255,0,0,0.5)" });
    } else {
      styleConf.fill = new Fill({ color: "rgba(255,255,255,0)" });
    }
    if (style.strokeColor) {
      styleConf.stroke = new Stroke({
        color: style.strokeColor || "rgba(255,0,255,0.75)",
        width: style.strokeWidth != void 0 ? style.strokeWidth : 4
      });
    }
    if (style.image) {
      if (style.image.type == "circle") {
        styleConf.image = new Circle({
          radius: style.image.radius != void 0 ? style.image.radius : 10,
          stroke: new Stroke({
            color: style.image.strokeColor || "#fff"
          }),
          fill: new Fill({
            color: style.image.fillColor || "#3399CC"
          })
        });
      } else if (style.image.type == "icon") {
        styleConf.image = new Icon({
          src: style.image.src || "",
          anchor: style.image.anchor || [0.5, 0.5],
          anchorXUnits: style.image.anchorXUnits || "fraction",
          anchorYUnits: style.image.anchorYUnits || "fraction",
          scale: style.image.scale || 1,
          rotation: style.image.rotation || 0,
          opacity: style.image.opacity || 1,
          color: style.image.color || "#000",
          crossOrigin: style.image.crossOrigin || "anonymous"
        });
      }
    }
    if (style.text) {
      if (style.text.static) {
        styleConf.text = new Text({ text: style.text.static, font: style.text.font || "12px Calibri,sans-serif", fill: new Fill({ color: style.text.fillColor || "#fff" }) });
      }
    }
    styleConf.src = "ol-themes-ext";
    return styleConf;
  }
  /**
   * Generates a style function for vector features with static styling and dynamic text labels.
   *
   * This method creates and returns a function that can be used as an OpenLayers style function.
   * The returned function applies a static style to features, but dynamically sets the text label
   * based on a property of each feature. It also supports highlighting features and customizes
   * text appearance such as font, fill, stroke, and padding.
   *
   * @param {string} endpoint - The endpoint associated with the vector source.
   * @param {Object} source - The vector source object containing features and highlight information.
   * @param {Object} styleConf - The style configuration object to be used or updated.
   * @param {Object} style - The style definition object, including text and highlight options.
   * @returns {function} A style function that takes an OpenLayers feature and returns an OpenLayers Style instance.
   */
  staticStylingWithDynamicTextLabels(endpoint, source, styleConf, style) {
    let that = this;
    this.style = style;
    this.styleConf = styleConf;
    this.source = source;
    this.endpoint = endpoint;
    return function(feature) {
      if (!that.styleConf) {
        that.styleConf = that.convertToStyleConf(that.style);
      }
      var val = "";
      if (feature.properties_ && feature.properties_[that.style.text.dynamic])
        val = feature.properties_[that.style.text.dynamic] + "";
      let declutterPadding = that.style.text.declutterPadding || 10;
      let style2 = that.style;
      if (that.source.highlightFeats[feature.getId()]) {
        console.log("highlighted", that.style, that.highlightStyle);
        style2 = that.highlightStyle;
      }
      that.styleConf.text = new Text({
        overflow: true,
        padding: [declutterPadding, declutterPadding, declutterPadding, declutterPadding],
        text: val,
        font: style2.text.font || "12px Calibri,sans-serif",
        fill: new Fill({
          color: style2.text.fillColor || "#fff"
        }),
        stroke: new Stroke({
          color: style2.text.strokeColor || "#fff",
          width: style2.text.strokeWidth != void 0 ? style2.text.strokeWidth : 1
        }),
        offsetX: style2.text.offsetX != void 0 ? style2.text.offsetX : 0,
        offsetY: style2.text.offsetY != void 0 ? style2.text.offsetY : 0
      });
      console.log("Returning style", that.styleConf);
      return new Style(that.styleConf);
    };
  }
  /**
   * Generates a style function for OpenLayers vector features based on static and highlight styles.
   * Applies a highlight style to features marked as highlighted in the source, otherwise applies the default static style.
   * If the style includes dynamic text labels, delegates to a specialized handler.
   *
   * @param {Object} endpoint - The endpoint configuration object containing style definitions.
   * @param {Object} source - The vector source object, expected to have a `highlightFeats` property mapping feature IDs to highlight status.
   * @returns {function} A style function that takes an OpenLayers feature and returns an OpenLayers Style instance.
   */
  staticStyling(endpoint, source) {
    this.endpoint = endpoint;
    this.source = source;
    this.style = this.endpoint.style.static;
    this.highlightStyle = endpoint.style.highlight;
    this.highlightStyleConf = null;
    if (this.highlightStyle) {
      console.log("highlight style", this.highlightStyle);
      this.highlightStyleConf = this.convertToStyleConf(this.highlightStyle);
      console.log("Converted", this.highlightStyleConf);
    } else {
      console.log("no highlight style, using default");
      this.highlightStyleConf = {};
      this.highlightStyleConf.fill = new Fill({ color: "rgba(255,255,100,0.7)" });
      this.highlightStyleConf.stroke = new Stroke({ color: "rgba(255,255,0,1)", width: 1 });
      this.highlightStyleConf.image = new Circle({ radius: 10, stroke: new Stroke({ color: "#fff" }), fill: new Fill({ color: "#3399CC" }) });
      this.highlightStyleConf.zIndex = 999;
    }
    console.log("Applying highlight style to endpoint", this.endpoint, this.highlightStyleConf);
    this.endpoint.highlightStyle = this.highlightStyleConf;
    this.styleConf = this.convertToStyleConf(this.style);
    if (this.style.text) {
      if (this.style.text.dynamic) {
        return this.staticStylingWithDynamicTextLabels(this.endpoint, this.source, this.styleConf, this.style);
      }
    }
    let that = this;
    return function(feature) {
      if (that.source.highlightFeats[feature.getId()]) {
        console.log("highlight style", that.highlightStyleConf, feature, that.endpoint, that.source);
        console.log("Returning highlight style");
        return new Style(that.highlightStyleConf);
      }
      console.log("Returning style");
      return new Style(that.styleConf);
    };
  }
  /**
   * Applies a vector style from a remote endpoint to the current layer.
   *
   * Fetches a style JSON from the provided endpoint, validates that all specified layers
   * share the same vector source, normalizes sprite and glyph URLs if present, and applies
   * the style to the layer. Handles errors for missing sources, mismatched sources, and
   * non-vector sources. Sets the source state to "ready" upon successful application.
   *
   * @param {Object} endpoint - The endpoint object containing the style URL.
   * @param {Object} source - The source object associated with the layer.
   *
   * @returns {void}
   */
  urlStyling(endpoint, source) {
    let that = layer;
    that.handleError = function(err) {
      console.error(err);
    };
    fetch(endpoint.style.url).then((resp) => {
      if (resp.ok)
        return resp.json();
      throw new Error(`Unexpected error: ${resp.status}`);
    }).then((style) => {
      let sourceId;
      let sourceIdOrLayersList;
      if (that.layers) {
        const lookup = {};
        for (let i = 0; i < style.layers.length; ++i) {
          const layer2 = style.layers[i];
          if (layer2.source) {
            lookup[layer2.id] = layer2.source;
          }
        }
        let firstSource;
        for (let i = 0; i < that.layers.length; ++i) {
          const candidate = lookup[that.layers[i]];
          if (!candidate) {
            that.handleError(
              new Error(`could not find source for ${that.layers[i]}`)
            );
            return;
          }
          if (!firstSource) {
            firstSource = candidate;
          } else if (firstSource !== candidate) {
            that.handleError(
              new Error(
                `layers can only use a single source, found ${firstSource} and ${candidate}`
              )
            );
            return;
          }
        }
        sourceId = firstSource;
        sourceIdOrLayersList = that.layers;
      } else {
        sourceId = that.sourceId;
        sourceIdOrLayersList = sourceId;
      }
      if (!sourceIdOrLayersList) {
        sourceId = Object.keys(style.sources)[0];
        sourceIdOrLayersList = sourceId;
      }
      if (style.sprite) {
        style.sprite = normalizeSpriteUrl(style.sprite, that.accessToken, endpoint.style.url);
      }
      if (style.glyphs) {
        style.glyphs = normalizeGlyphsUrl(style.glyphs, that.accessToken, endpoint.style.url);
      }
      const styleSource = style.sources[sourceId];
      let SourceState = { READY: "ready" };
      if (styleSource.type !== "vector") {
        that.handleError(
          new Error(`only works for vector sources, found ${styleSource.type}`)
        );
        return;
      }
      const source2 = that.getSource();
      applyStyle(that, style, sourceIdOrLayersList).then(() => {
        source2.setState(SourceState.READY);
      }).catch((error) => {
        that.handleError(error);
      });
    });
  }
}
class ConfigurableStyle {
  constructor(endpoint, source, layer2) {
    this.endpoint = endpoint;
    this.getStyle = () => {
      console.log("Error parsing style");
    };
    if (endpoint.style) {
      let configurableStyleEngine2 = new ConfigurableStyleEngine();
      if (endpoint.style.url) {
        this.getStyle = configurableStyleEngine2.urlStyling(endpoint, source);
      } else if (endpoint.style.dynamic) {
        this.getStyle = configurableStyleEngine2.dynamicStyling(endpoint, source);
      } else if (endpoint.style.static) {
        this.getStyle = configurableStyleEngine2.staticStyling(endpoint, source);
      }
    } else {
      this.getStyle = configurableStyleEngine.unstyled;
    }
  }
}
const _styleFunction = (endpoint, source, layer2) => {
  let style = new ConfigurableStyle(endpoint, source, layer2);
  return style.getStyle;
};

export { ConfigurableStyle, _styleFunction };
//# sourceMappingURL=vectorStyles.js.map
