import FillPattern from 'ol-ext/style/FillPattern';
import { Style, Fill, Stroke, Circle as CircleStyle, Text } from 'ol/style';
import { _checkFilter } from './filterEngine'


import { getLogger } from './logger'

class test {
  constructor() {}
  moo = () => { console.log("moo") }
}

class ConfigurableStyleEngine {
  constructor() {

    this.highlightStyleConf = {
      fill: new Fill({ color: "rgba(255,255,100,0.7)" }),
      stroke: new Stroke({ color: "rgba(255,255,0,1)", width: 1 }),
      image: new CircleStyle({ radius: 10, stroke: new Stroke({ color: '#fff', }), fill: new Fill({ color: '#3399CC', }), }),
      zIndex: 999
    };
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
    var renderFeature = true;
    var fev = feature.get("FilterEngine");
    var r = true;

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

      var renderFeature = this.featureShouldBeRendered(source, feature);


      let map = endpoint.style.dynamic.map;
      let field = endpoint.style.dynamic.field;

      if (!renderFeature) {
        return invisibleStyle;
      } else if (feature.get("selected")) {
        return selectedStyle;
      } else if (feature && ((feature.properties_ && feature.properties_[field]) || feature.get && feature.get(field))) {
        var val = feature.properties_ ? feature.properties_[field] + "" : feature.get(field) + "";
        if (map[val]) {
          var style = map[val];

          let styleConf = this.convertToStyleConf(style);

          return new Style(styleConf);
        }
        else {
          return this.invisibleStyle;
        }
      }
      else {
        return this.unstyled;
      }

    }
  }

  convertToStyleConf (style) {
    let styleConf = {};

    if (style.pattern) {
      styleConf.fill = pattern(style);
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

      var val = "";
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

    this.highlightStyle = endpoint.style.highlight;

    this.highlightStyleConf = null;

    if (this.highlightStyle) {
      this.highlightStyleConf = this.convertToStyleConf(this.highlightStyle);
    }
    else {
      this.highlightStyleConf = {};

      this.highlightStyleConf.fill = new Fill({ color: "rgba(255,255,100,0.7)" });
      this.highlightStyleConf.stroke = new Stroke({ color: "rgba(255,255,0,1)", width: 1 });
      this.highlightStyleConf.image = new CircleStyle({ radius: 10, stroke: new Stroke({ color: '#fff', }), fill: new Fill({ color: '#3399CC', }), });
      this.highlightStyleConf.zIndex = 999;
    }

    this.endpoint.highlightStyle = this.highlightStyleConf;



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

    if (endpoint.style) {
      let configurableStyleEngine = new ConfigurableStyleEngine();

      if (endpoint.style.url) {
        this.getStyle = configurableStyleEngine.urlStyling(endpoint, source);
      }
      else if (endpoint.style.dynamic) {
        this.getStyle = configurableStyleEngine.dynamicStyling(endpoint, source);
      }
      else if (endpoint.style.static) {
        this.getStyle = configurableStyleEngine.staticStyling(endpoint, source);
      }
    }
    else {
      this.getStyle = configurableStyleEngine.unstyled;
    }
  }
}