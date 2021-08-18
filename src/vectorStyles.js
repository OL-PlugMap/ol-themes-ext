import FillPattern from 'ol-ext/style/FillPattern';
import { Style, Fill, Stroke } from 'ol/style';


import {getLogger} from './logger'

export const pattern = (style) => {
    let opts = style.pattern;
    opts.color = style.strokeColor
    opts.fill = new Fill( { color: style.fillColor } );
    return new FillPattern(opts);
  
  };


export const dynamicStyling = (endpoint, source) => {
    return function (feature) {
      getLogger()(feature);
      if (source.highlightFeats[feature.getId()]) {
        return new Style({
          fill: new Fill({
            color: "rgba(255,255,0,1)"
          }),
          stroke: new Stroke({
            color: "rgba(255,255,0,0)",
            width: 0
          })
        })
      }
  
      var renderFeature = true;
      var fev = feature.get("FilterEngine");
      var r = true;
  
      if (fev && fev.renderFn) {
        fev.renderFn();
        r = fev.render;
      }
  
      renderFeature = feature.get("selected") || r;
  
      let map = endpoint.style.dynamic.map;
      let field = endpoint.style.dynamic.field;
      if (!renderFeature) {
        return new Style({
          fill: new Fill({
            color: "rgba(0,0,0,0)"
          }),
          stroke: new Stroke({
            color: "rgba(0,0,0,0)",
            width: 0
          })
        })
      } else if (feature.get("selected")) {
        return new Style({
          fill: new Fill({
            color: "rgba(255,255,100,0.7)"
          }),
          stroke: new Stroke({
            color: "rgba(255,255,0,1)",
            width: 1
          })
        })
      } else if ( feature && ( (feature.properties_ && feature.properties_[field]) || feature.get && feature.get(field) ) ) {
        var val = feature.properties_ ? feature.properties_[field] + "" : feature.get(field) + "";
        if (map[val]) {
          var style = map[val];
          return new Style({
            fill: style.pattern ? pattern(style) : new Fill({
              color: style.fillColor || "rgba(255,0,0,0.5)"
            }),
            stroke: new Stroke({
              color: style.strokeColor || "rgba(255,0,255,0.75)",
              width: style.strokeWidth != undefined ? style.strokeWidth : 4
            })
          })
        }
        else {
          //Need default style
  
          return new Style({
            fill: new Fill({
              color: "rgba(255,255,255,0)"
            }),
            stroke: new Stroke({
              color: "rgba(0,0,0,0)",
              width: 4
            })
          })
        }
      }
      else
      {
        return new Style({
          fill: new Fill({
            color: "rgba(255,255,255,0.5)"
          }),
          stroke: new Stroke({
            color: "rgba(0,0,0,0.75)",
            width: 4
          })
        })
      }
  
    }
}

export const  _styleFunction = (endpoint, source, layer) => {

    if (endpoint.style) {
      if (endpoint.style.url) {
        let that = layer;
        that.handleError = function(err) { console.error(err); };
        let SourceType = { VECTOR : "vector" }
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
          let SourceType = { VECTOR : "vector" }
          let SourceState = { READY : "ready" }
          if (styleSource.type !== "vector") {
            that.handleError(
              new Error(`only works for vector sources, found ${styleSource.type}`)
            );
            return;
          }
  
          const source = that.getSource();
  
          //source.setUrl(normalizeSourceUrl(styleSource.url, that.accessToken, endpoint.style.url));
  
          applyStyle(that, style, sourceIdOrLayersList)
            .then(() => {
              source.setState(SourceState.READY);
            })
            .catch((error) => {
              that.handleError(error);
            });
        })
      }
      else if (endpoint.style.static) {
        var style = endpoint.style.static;
  
        return new Style({
          fill: new Fill({
            color: style.fillColor || "rgba(255,0,0,0.5)"
          }),
          stroke: new Stroke({
            color: style.strokeColor || "rgba(255,0,255,0.75)",
            width: style.strokeWidth != undefined ? style.strokeWidth : 4
          })
        })
      }
      else if (endpoint.style.dynamic) {
        return dynamicStyling(endpoint, source);
      }
    }
    else {
      return new Style({
        fill: new Fill({
          color: endpoint.fillColor || "rgba(255,0,0,0.5)"
        }),
        stroke: new Stroke({
          color: endpoint.strokeColor || "rgba(255,0,255,0.75)",
          width: style.strokeWidth != undefined ? style.strokeWidth : 4
        })
      })
    }
  };