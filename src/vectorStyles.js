import FillPattern from 'ol-ext/style/FillPattern';
import { Style, Fill, Stroke, Circle as CircleStyle, Text } from 'ol/style';
import { _checkFilter } from './filterEngine'


import { getLogger } from './logger'

class ConfigurableStyleEngine {
  constructor(endpoint) {


    this.highlightStyleConf = null;

    if (endpoint.style.highlight ) {
      this.highlightStyleConf = this.convertToStyleConf(endpoint.style.highlight );
      this.highlightStyleConf.zIndex = 999;
    }
    else {
      
      this.highlightStyleConf = {
        fill: new Fill({ color: "rgba(255,255,100,0.7)" }),
        stroke: new Stroke({ color: "rgba(255,255,0,1)", width: 1 }),
        image: new CircleStyle({ radius: 10, stroke: new Stroke({ color: '#fff', }), fill: new Fill({ color: '#3399CC', }), }),
        zIndex: 999
      };
    }

    this.invisibleStyleConf = {
      fill: new Fill({ color: "rgba(255,255,255,0.0)" }),
      stroke: new Stroke({ color: "rgba(255,255,255,0.0)", width: 1 }),
    }

    this.highlightStyle = new Style(this.highlightStyleConf);

    this.invisibleStyle = new Style(this.invisibleStyleConf);

    this.selectedStyleConf = {
      fill: new Fill({
        color: "rgba(255,255,100,0.7)"
      }),
      stroke: new Stroke({
        color: "rgba(255,255,0,1)",
        width: 1
      }),
    }

    this.selectedStyle = new Style(this.selectedStyleConf);

    this.unstyledConf = {
      fill: new Fill({
        color: "rgba(255,255,255,0.5)"
      }),
      stroke: new Stroke({
        color: "rgba(0,0,0,0.75)",
        width: 4
      }),
    };

    this.unstyled = new Style(this.unstyledConf);
  }

  pattern(style) {
    let opts = style.pattern;
    opts.color = style.strokeColor
    opts.fill = new Fill({ color: style.fillColor });
    return new FillPattern(opts);
  };

  featureIsHighlighted (source, feature) {
    return source.highlightFeats[feature.getId()];
  }

  featureShouldBeRendered (source, feature) {
    let renderFeature = true;
    let fev = feature.get("FilterEngine");
    let r = true;

    if (fev && fev.renderFn) {
      fev.renderFn();
      r = fev.render;
    }

    //Apparently webpack didnt take too kindly to ?. so I rewrote this to play nicer with it for now ...
    if (source.filterSet && source.filterSet.mode && source.filterSet.mode != "NONE") {
      let isRenderable = _checkFilter(source, feature);
      getLogger()(isRenderable);
      r = isRenderable;
    }

    renderFeature = feature.get("selected") || r;

    return renderFeature;
  }

  dynamicStyling (endpoint, source) {

    let that = this;

    return function (feature) {
      let styleConf = {};

      if (that.featureIsHighlighted(source, feature)) {
        return that.highlightStyle;
      }

      let renderFeature = that.featureShouldBeRendered(source, feature);


      let map = endpoint.style.dynamic.map;
      let field = endpoint.style.dynamic.field;

      if (!renderFeature) {
        return that.invisibleStyle;
      } else if (feature.get("selected")) {
        return selectedStyle;
      } else if (feature && ((feature.properties_ && feature.properties_[field] !== undefined) || feature.get && feature.get(field))) {
        let val = feature.properties_ ? feature.properties_[field] + "" : feature.get(field) + "";
        if (map[val]) {
          let style = map[val];

          let styleConf = that.convertToStyleConf(style);

          return new Style(styleConf);
        }
        else {
          return that.invisibleStyle;
        }
      }
      else {
        return that.unstyled;
      }

    }
  }

  async dynamicLegend (endpoint, source) {
    // Iterate through all the possible mapped values and populate the legend
    let legend = [];

    let map = endpoint.style.dynamic.map;
    let keys = Object.keys(map);
    for (const element of keys) {
      let key = element;
      let style = map[key];

      let entry = this.convertToLegend(style);
      legend.push(entry);
    }

    return legend;
  }

  convertToStyleConf (style) {
    let styleConf = {};

    if (style.pattern) {
      styleConf.fill = this.pattern(style);
    } else if (style.fillColor) {
      styleConf.fill = new Fill({ color: style.fillColor || "rgba(255,0,0,0.5)" });
    }
    else {
      styleConf.fill = new Fill({ color: "rgba(255,255,255,0)" });
    }

    if (style.strokeColor) {
      styleConf.stroke = new Stroke({
        color: style.strokeColor || "rgba(255,0,255,0.75)",
        width: style.strokeWidth != undefined ? style.strokeWidth : 4
      });
    }

    if (style.image) {
      if (style.image.type == "circle") {
        styleConf.image = new CircleStyle({
          radius: style.image.radius != undefined ? style.image.radius : 10,
          stroke: new Stroke({
            color: style.image.strokeColor || '#fff',
          }),
          fill: new Fill({
            color: style.image.fillColor || '#3399CC',
          })
        });
      }
      else if (style.image.type == "icon") {
        styleConf.image = new Icon({
          src: style.image.src || '',
          anchor: style.image.anchor || [0.5, 0.5],
          anchorXUnits: style.image.anchorXUnits || 'fraction',
          anchorYUnits: style.image.anchorYUnits || 'fraction',
          scale: style.image.scale || 1,
          rotation: style.image.rotation || 0,
          opacity: style.image.opacity || 1,
          color: style.image.color || '#000',
          crossOrigin: style.image.crossOrigin || 'anonymous'
        });
      }
    }

    if (style.text) {
      if (style.text.static) {
        styleConf.text = new Text({ text: style.text.static, font: style.text.font || '12px Calibri,sans-serif', fill: new Fill({ color: style.text.fillColor || '#fff', }) });
      }
    }

    styleConf.src = "ol-themes-ext";

    return styleConf;
  }

  convertToLegend (style) {
    
    // This function will return a legend for the given style.
    // The legend is a list of legend entries
    // Each legend entry has a label and a symbol.
    // the label is a human readable string
    // the symbol is a svg element that can be used to display the legend entry.
    // the symbol can be one of the following:
    // - a color
    // - an image
    
    
    if(style.pattern) {
      // Generate an image using the ol-ext pattern library
      let pattern = this.pattern(style);
      let image = pattern.getImage().toDataURL();
      
      return { 
        label: style.label || "",
        image
      }
    } else if(style.fillColor) {
      // Set the color on the legend entry
      return {
        label: style.label || "",
        color: style.fillColor || "rgba(255,0,0,0.5)"
      };
    }

    if(style.image) {
      if(style.image.type == "circle") {
        // Generate a circle on the legend entry
        // Create a canvas element
        // Draw a circle on the canvas
        // Create a data url from the canvas
        // Set the image on the legend entry

        let canvas = document.createElement("canvas");
        let ctx = canvas.getContext("2d");
        let radius = style.image.radius != undefined ? style.image.radius : 10;
        let strokeWidth = style.image.strokeWidth != undefined ? style.image.strokeWidth : 4;
        let strokeColor = style.image.strokeColor != undefined ? style.image.strokeColor : '#fff';
        let fillColor = style.image.fillColor != undefined ? style.image.fillColor : '#3399CC';
        let width = radius * 2 + strokeWidth;
        let height = radius * 2 + strokeWidth;
        canvas.width = width;
        canvas.height = height;
        ctx.beginPath();
        ctx.arc(radius, radius, radius, 0, 2 * Math.PI);
        ctx.lineWidth = strokeWidth;
        ctx.strokeStyle = strokeColor;
        ctx.stroke();
        ctx.fillStyle = fillColor;
        ctx.fill();
        let dataUrl = canvas.toDataURL();
        return {
          label: style.label || "",
          image: dataUrl
        };
      } else if(style.image.type == "icon") {
        // Return the icon on the legend entry
        return {
          label: style.label || "",
          icon: style.image.src || ""
        };
      }
    }



  }

  staticStylingWithDynamicTextLabels (endpoint, source, styleConf, style) {
    let that = this;
    this.style = style;
    this.styleConf = styleConf;
    this.source = source;
    this.endpoint = endpoint;

    return function (feature) {
      if (!that.styleConf) {
        that.styleConf = that.convertToStyleConf(that.style);
      }

      let val = "";
      if (feature.properties_ && feature.properties_[that.style.text.dynamic])
        val = feature.properties_[that.style.text.dynamic] + "";


      let declutterPadding = that.style.text.declutterPadding || 10;

      let style = that.style;

      if (that.source.highlightFeats[feature.getId()]) {
        style = that.highlightStyle;
      }

      that.styleConf.text = new Text({
        overflow: true,
        padding: [declutterPadding, declutterPadding, declutterPadding, declutterPadding],
        text: val,
        font: style.text.font || '12px Calibri,sans-serif',
        fill: new Fill({
          color: style.text.fillColor || '#fff',
        }),
        stroke: new Stroke({
          color: style.text.strokeColor || '#fff',
          width: style.text.strokeWidth != undefined ? style.text.strokeWidth : 1
        }),
        offsetX: style.text.offsetX != undefined ? style.text.offsetX : 0,
        offsetY: style.text.offsetY != undefined ? style.text.offsetY : 0,
      });

      return new Style(that.styleConf);

    }
  }

  staticStyling (endpoint, source) {
    this.endpoint = endpoint;
    this.source = source;

    this.style = this.endpoint.style.static;

    this.styleConf = this.convertToStyleConf(this.style);


    if (this.style.text) {
      if (this.style.text.dynamic) {
        return this.staticStylingWithDynamicTextLabels(this.endpoint, this.source, this.styleConf, this.style);
      }
    }

    let that = this;

    return function (feature) {
      if (that.source.highlightFeats[feature.getId()]) {
        return new Style(that.highlightStyleConf);
      }

      return new Style(that.styleConf);
    }
  }

  async staticLegend (endpoint, source) {
    let legend = [ this.convertToLegend(this.style) ];
    legend.push({"label": "No data"});
    return legend;
  }

  urlStyling (endpoint, source) {
    let that = layer;
    that.handleError = function (err) { console.error(err); };
    let SourceType = { VECTOR: "vector" }
    fetch(endpoint.style.url).then(resp => {
      if (resp.ok)
        return resp.json();
      throw new Error(`Unexpected error: ${resp.status}`)
    }).then((style) => {
      let sourceId;
      let sourceIdOrLayersList;
      if (that.layers) {
        // confirm all layers share the same source
        const lookup = {};
        for (let i = 0; i < style.layers.length; ++i) {
          const layer = style.layers[i];
          if (layer.source) {
            lookup[layer.id] = layer.source;
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
        // default to the first source in the style
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
      let SourceType = { VECTOR: "vector" }
      let SourceState = { READY: "ready" }
      if (styleSource.type !== "vector") {
        that.handleError(
          new Error(`only works for vector sources, found ${styleSource.type}`)
        );
        return;
      }

      const source = that.getSource();

      applyStyle(that, style, sourceIdOrLayersList)
        .then(() => {
          source.setState(SourceState.READY);
        })
        .catch((error) => {
          that.handleError(error);
        });
    })
  }
}




export class ConfigurableStyle {

  constructor(endpoint, source, layer) {

    this.endpoint = endpoint;

    this.getStyle = () => { console.log("Error parsing style") };
    this.getLegend = () => { console.log("Error parsing legend") };

    if (endpoint.style) {
      let configurableStyleEngine = new ConfigurableStyleEngine(endpoint);

      if (endpoint.style.url) {
        this.getStyle = configurableStyleEngine.urlStyling(endpoint, source);

        //TODO:
        this.getLegend = async () => { return [{ "label": "Not Implemented" }]};
      }
      else if (endpoint.style.dynamic) {
        this.getStyle = configurableStyleEngine.dynamicStyling(endpoint, source);
        this.getLegend = configurableStyleEngine.dynamicLegend(endpoint, source);
      }
      else if (endpoint.style.static) {
        this.getStyle = configurableStyleEngine.staticStyling(endpoint, source);
        this.getLegend = configurableStyleEngine.staticLegend(endpoint, source);
      }
    }
    else {
      this.getStyle = configurableStyleEngine.unstyled;
    }
  }
}