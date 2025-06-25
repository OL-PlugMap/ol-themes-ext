import TileGrid from "ol/tilegrid/TileGrid"
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import {createXYZ} from 'ol/tilegrid';
import { Fill, Stroke, Style } from 'ol/style';
import EsriJSON from 'ol/format/EsriJSON';
import { get } from "ol/proj";
import { getWidth } from "ol/extent";
import {tile as tileStrategy} from 'ol/loadingstrategy';
import { getLogger, getWarning } from "./logger";
import { createStyleFunction } from 'ol-esri-style-10';


const esrijsonFormat = new EsriJSON();

export const generate = (data, core) => {
    let layers = data.config.value.endpoints.map(endpoint => {
    //The random adds a random value to the parameter
    //essentually cache busting  
    let customParams = {
      get random() {
        return Math.random();
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


    endpoint.styleCache = {};
    endpoint.styleFunction = function(feature)
    {
      if(!endpoint.styleCache)
      {
        return new Style({
          fill: new Fill({
            color: "rgba(255,0,0,0.5)"
          }),
          stroke: new Stroke({
            color: "rgba(255,0,255,0.75)",
            width: 4
          })
        })
      }
      else
      {
        if(feature.get(endpoint.styleCache.field))
        {
          if(endpoint.styleCache.map[feature.get(endpoint.styleCache.field)])
          {
            return endpoint.styleCache.map[feature.get(endpoint.styleCache.field)];
          }
          else
          {
            getLogger()("Cant find mapped value for " + feature.get(endpoint.styleCache.field))
            return new Style({
              fill: new Fill({
                color: "rgba(255,0,0,0.5)"
              }),
              stroke: new Stroke({
                color: "rgba(255,0,255,0.75)",
                width: 4
              })
            })
          }
        }
      }
    }

    if(!endpoint.style) {
      window.fetch(endpoint.url + "?f=json")
      .then(resp => { return resp.json() } )
      .then(meta => {
        try
        {
          getLogger()("Style", meta);
          console.log("Metadata", meta);
          //setMapProjection(core.getMap().getView().getProjection());
          createStyleFunction(meta).then(styleFunction => {
            getLogger()("Debug stuff here");
            endpoint.styleFunction = (feature, resolution) => {
              getLogger()(feature);
              return styleFunction(feature, resolution);
            }

            getLogger()("Setting FN");
            endpoint.layerRef.setStyle(endpoint.styleFunction);
          })
          .catch((err) => {
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
              })
            };

            getLogger()("Setting FN");
            endpoint.layerRef.setStyle(endpoint.styleFunction);
          })
        }
        catch(ex)
        {
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
            })
          };

          getLogger()("Setting FN");
          endpoint.layerRef.setStyle(endpoint.styleFunction);
        }
        // var rend = (meta && meta.drawingInfo ? meta.drawingInfo.renderer : {}) || {} ;
        // if(!rend)
        // {
        //   getWarning()("The included service didnt have drawing info. This can happen if you dont pass in the layer with the url. For example: somedomain.com/somepath/FeatureServer/0/");
        //   endpoint.styleCache = false;
        //   return;
        // }

        // let rendererType = rend.type;

        // switch(rendererType)
        // {
        //   case "uniqueValue": {
        //     getLogger()("Found a unique value renderer");
        //     if(rend.field2)
        //     {
        //       getWarning()("This renderer has multiple fields. Currently only the first field is supported, the rest are ignored. Please open an issue on this library with the following values.", endpoint, rend);
        //     }
        //     var field = rend.field1;
        //     endpoint.styleCache.field = field;
        //     endpoint.styleCache.map = {};
        //     for(var inf of rend.uniqueValueInfos)
        //     {
        //       var sym = inf.symbol;
        //       endpoint.styleCache.map[inf.value] =
        //         new Style({
        //           fill: new Fill({
        //             color: `rgba(${sym.color[0]},${sym.color[1]},${sym.color[2]},${sym.color[3]/255})`
        //           }),
        //           stroke: new Stroke({
        //             color: `rgba(${sym.outline.color[0]},${sym.outline.color[1]},${sym.outline.color[2]},${sym.outline.color[3]/255})`,
        //             width: sym.outline.width || 4
        //           })
        //         })
        //     }
        //   }; break;

        //   default: {
        //     getWarning()("Unsupported renderer detected. Please open an issue on this library with the following value.", endpoint, rend)
        //   }; break;

        // }

        
      })
      .catch(a => {
          getWarning()("Unable to get style from provided URL", endpoint.url, a. endpoint)
          endpoint.styleCache = false;
      });
    }

    

    let source = new VectorSource({
      loader: function (extent, resolution, projection) {
        let outfields = endpoint.outfields ? endpoint.outfields.join(",") : "*";
        var url =
          endpoint.url +
          '/query/?f=json&' +
          'returnGeometry=true&spatialRel=esriSpatialRelIntersects&geometry=' +
          encodeURIComponent(
            '{"xmin":' +
              extent[0] +
              ',"ymin":' +
              extent[1] +
              ',"xmax":' +
              extent[2] +
              ',"ymax":' +
              extent[3] +
              ',"spatialReference":{"wkid":102100}}'
          ) +
          '&geometryType=esriGeometryEnvelope&inSR=102100&outFields=' + outfields
          '&outSR=102100';
        window.fetch(url)
        .then((response) => { return response.text() })
        .then((txt) => {
              var features = esrijsonFormat.readFeatures(txt, {
                featureProjection: projection,
              });
              if (features.length > 0) {
                source.addFeatures(features);
              }
            //}
          },
        )
        .catch((err) => {
          getWarning()("Unhandled exception in esri feature loader", err)
        })
      },
      strategy: tileStrategy(
        createXYZ({
          tileSize: 512,
        })
      ),
    });

    let style = endpoint.style || {};

    let lyr = new VectorLayer({
      source: source,
      zIndex: endpoint.zIndex || 0,
      opacity: data.opacity || 1,
      style: endpoint.styleFunction
    });
    lyr.set('id', data.key);

    source.applyFilters =
      function (ls) {
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

    // if (endpoint.tokenKey) {
    //   // if the token data has already been fetched and stored in core.services
    //   // go ahead and configure the source w/ the data, otherwise, postpone
    //   // the configuration until `setServicesCmd` has been triggered
    //   if (core.services && core.services[endpoint.tokenKey]) {
    //     configureSource(endpoint.tokenKey);
    //   } else {
    //     self.pendingConfiguration.push({
    //       name: data.key,
    //       fn: configureSource,
    //       params: [endpoint.tokenKey]
    //     });
    //   }
    // }
    // else {
    //   source.setUrl(endpoint.url);
    //   source.params_ = customParams;
    // }
    lyr.setVisible(false);
    endpoint.layerRef = lyr;
    return lyr;
  });

  return layers;
};

/**
 * Helper class to build configuration objects for the esriFeature generate function.
 *
 * Example usage:
 *   const config = new EsriFeatureConfigBuilder()
 *     .setKey('myLayerGroup')
 *     .setOpacity(0.8)
 *     .setExtent([-13884991, 2870341, -7455066, 6338219])
 *     .addEndpoint({
 *       url: 'https://example.com/arcgis/rest/services/Layer/FeatureServer/0',
 *       bbox: '...',
 *       layersToShow: '0,1,2',
 *       zIndex: 2,
 *       tokenKey: 'myToken',
 *       style: myStyleFunction // or a static style object
 *     })
 *     .build();
 */
export class EsriFeatureConfigBuilder {
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

  /**
   * Set the opacity for the layer group.
   * @param {number} opacity
   * @throws {Error} If opacity is not a number between 0 and 1.
   * @returns {EsriFeatureConfigBuilder} Returns the builder instance for chaining.
   */
  setOpacity(opacity) {
    if (typeof opacity !== 'number' || opacity < 0 || opacity > 1) {
      throw new Error('Opacity must be a number between 0 and 1.');
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
    if (typeof zIndex !== 'number') {
      throw new Error('Z-index must be a number.');
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
    if (typeof hidden !== 'boolean') {
      throw new Error('Hidden must be a boolean value.');
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
    // style can be a function or an object, so no strict validation

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

      esriFeature: this._config.config.value,
    }
  }
}

/**
 * Builder for a single endpoint configuration for EsriFeatureConfigBuilder.
 *
 * Example usage:
 *   const endpoint = new EsriFeatureEndpointConfigBuilder()
 *     .setUrl('https://example.com/arcgis/rest/services/Layer/FeatureServer/0')
 *     .setBbox('...')
 *     .setLayersToShow('0,1,2')
 *     .setZIndex(2)
 *     .setTokenKey('myToken')
 *     .setStyle(myStyleFunction) // or a static style object
 *     .build();
 */
export class EsriFeatureEndpointConfigBuilder {
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
    // style can be a function or an object, so no strict validation

    return { ...this._endpoint };
  }
}