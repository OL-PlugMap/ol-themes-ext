import { Group as LayerGroup, Tile as TileLayer } from "ol/layer.js";
import XYZ from "ol/source/XYZ";
import { get } from "ol/proj";
import { getWidth } from "ol/extent";
import WMTS from "ol/source/WMTS";
import WMTSTileGrid from "ol/tilegrid/WMTS";
import ImageWMS from 'ol/source/ImageWMS.js';
import ImageLayer from "ol/layer/Image";
import { ImageArcGISRest, TileArcGISRest } from "ol/source";
import TileGrid from "ol/tilegrid/TileGrid"

import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';

import {tile as tileStrategy} from 'ol/loadingstrategy';
import {createXYZ} from 'ol/tilegrid';


import { Fill, Stroke, Style, CircleStyle } from 'ol/style';
import { applyStyle } from 'ol-mapbox-style';
import EsriJSON from 'ol/format/EsriJSON';

import * as mvt from './mvt'

const esrijsonFormat = new EsriJSON();

const mapboxBaseUrl = 'https://api.mapbox.com';

/**
 * Gets the path from a mapbox:// URL.
 * @param {string} url The Mapbox URL.
 * @return {string} The path.
 * @private
 */
export function getMapboxPath(url) {
  const startsWith = 'mapbox://';
  if (url.indexOf(startsWith) !== 0) {
    return '';
  }
  return url.slice(startsWith.length);
}

/**
 * Turns mapbox:// sprite URLs into resolvable URLs.
 * @param {string} url The sprite URL.
 * @param {string} token The access token.
 * @return {string} A resolvable URL.
 * @private
 */
export function normalizeSpriteUrl(url, token, baseUrl) {
  if(url.startsWith(".."))
    return baseUrl + "/" + url;
  const mapboxPath = getMapboxPath(url);
  if (!mapboxPath) {
    return url;
  }
  const startsWith = 'sprites/';
  if (mapboxPath.indexOf(startsWith) !== 0) {
    throw new Error(`unexpected sprites url: ${url}`);
  }
  const sprite = mapboxPath.slice(startsWith.length);

  return `${mapboxBaseUrl}/styles/v1/${sprite}/sprite?access_token=${token}`;
}

/**
 * Turns mapbox:// glyphs URLs into resolvable URLs.
 * @param {string} url The glyphs URL.
 * @param {string} token The access token.
 * @return {string} A resolvable URL.
 * @private
 */
export function normalizeGlyphsUrl(url, token, baseUrl) {
  if(url.startsWith(".."))
    return baseUrl + "/" + url;
  const mapboxPath = getMapboxPath(url);
  if (!mapboxPath) {
    return url;
  }
  const startsWith = 'fonts/';
  if (mapboxPath.indexOf(startsWith) !== 0) {
    throw new Error(`unexpected fonts url: ${url}`);
  }
  const font = mapboxPath.slice(startsWith.length);

  return `${mapboxBaseUrl}/fonts/v1/${font}/0-255.pbf?access_token=${token}`;
}

/**
 * Turns mapbox:// style URLs into resolvable URLs.
 * @param {string} url The style URL.
 * @param {string} token The access token.
 * @return {string} A resolvable URL.
 * @private
 */
export function normalizeStyleUrl(url, token, baseUrl) {
  if(url.startsWith(".."))
    return baseUrl + "/" + url;
  const mapboxPath = getMapboxPath(url);
  if (!mapboxPath) {
    return url;
  }
  const startsWith = 'styles/';
  if (mapboxPath.indexOf(startsWith) !== 0) {
    throw new Error(`unexpected style url: ${url}`);
  }
  const style = mapboxPath.slice(startsWith.length);

  return `${mapboxBaseUrl}/styles/v1/${style}?&access_token=${token}`;
}

/**
 * Turns mapbox:// source URLs into vector tile URL templates.
 * @param {string} url The source URL.
 * @param {string} token The access token.
 * @return {string} A vector tile template.
 * @private
 */
export function normalizeSourceUrl(url, token, baseUrl) {
  if(url.startsWith(".."))
    return baseUrl + "/" + url;
  const mapboxPath = getMapboxPath(url);
  if (!mapboxPath) {
    return url;
  }
  return `https://{a-d}.tiles.mapbox.com/v4/${mapboxPath}/{z}/{x}/{y}.vector.pbf?access_token=${token}`;
}

export default class Themes {
  constructor() {
    this.pendingConfiguration = [];
    this.core = null;
    this.lastState = {}
    this.states = [];
    this.layerMap = {};

    window.layerMap = this.layerMap;
  }

  apply(core) {
    this.core = core;

    //core.on("setServicesCmd", this.processPending.bind(this));
  }

  save() {
    this.states.push(this.lastState);
  }

  revert() {
    this.toggleSelectedThemes(this.states.pop())
  }


  processPending() {
    let self = this;
    this.pendingConfiguration.forEach(item => {
      item.fn.apply(self, item.params);
    });
  }

  init() { }

  addLayers(layers) {

    let self = this;
    let core = this.core;
    let map = core.getMap();

    let layersMapped = layers.map(layer => {
      return self.makeLayer.call(self, layer);
    });

    
    layersMapped.map(layer => {
      
      return layer;
    });
    
    return layersMapped;
  }

  /*
    This converts a list of "categories" into a list of layer groups
    It also adds extensions needed to control category selection
  */
  addLayerCategories(categories) {
    let self = this;
    let core = this.core;
    let map = core.getMap();
    let groups = categories.map(category => {

      let selectionKeys = category.selection.selection_key ? [ category.selection.selection_key ] : category.selection.selection_keys;

      let layers = category.layers.map(layer => {
        let lyr = self.makeLayer.call(self, layer);
        if(selectionKeys.includes(layer.key))
          lyr.setVisible(true);

        return lyr;
      });

      // show layers that are part of current selection
      // and hide ones that are not part of current selection
      self.setLayerVisibilities(category.selection, layers);

      // group category layers into a layer group
      let group = new LayerGroup({
        opacity: category.opacity,
        layers: layers
      });
      group.metadata = 
        { key : category.category_key,
          name: category.category_name
        }
      group.set('id', category.category_key);
      group.set('selection_type', category.selection.selection_type)
      group.set('selection_keys', selectionKeys)
      group.selectLayer = this.selectLayer(group)
      group.deselectLayer = this.deselectLayer(group)
      return group;
    });
    groups.forEach(group => map.addLayer(group));
    return groups;
  }

  selectLayer(category) {
    return function(layerToSelect) {
      if(typeof layerToSelect == "string")
      {
        var lyrs = category.getLayersArray();

        var filt = lyrs.filter(a => a.get('id') == layerToSelect)
        
        if(filt && filt.length)
          layerToSelect = filt[0];
        else
          console.log("Couldnt find layer by id", layerToSelect);
      }  
      let categoryId = category.get('id');
      let selectionType = category.get('selection_type');
      let selectionKeys = category.get('selection_keys');
      let targetKey = layerToSelect.get('id');

      switch(selectionType)
      {
        case 'monoselection':
        case 'monoselective':
            category.getLayers().forEach(layer =>
              {
                //toggleLayer(layer, targetKey === layer.get('id'))
                layer.setVisible(false);
              });
              layerToSelect.setVisible(true);
              selectionKeys = [ targetKey ];
          break;
        case 'polyselection':
        case 'polyselective':
          if(!selectionKeys.includes(targetKey))
          {
            layerToSelect.setVisible(true);
            selectionKeys.push(targetKey);
          }
          break;

        default: console.log("Unknown selection type", selectionType, "looking for one of [monoselection,monoselective,polyselection,polyselective]");
      }

      
      category.set('selection_keys', selectionKeys);
    }
  }

  deselectLayer(category) {
    return function(layerToSelect) {
      if(typeof layerToSelect == "string")
      {
        var filt = category.getLayersArray().filter(a => a.get('id') == layerToSelect)
        if(filt && filt.length)
          layerToSelect = filt[0];
        else
          console.log("Couldnt find layer by id", layerToSelect);
      }  
      let categoryId = category.get('id');
      let selectionType = category.get('selection_type');
      let selectionKeys = category.get('selection_keys');
      let targetKey = layerToSelect.get('id');

      switch(selectionType)
      {
        case 'monoselective':
        case 'monoselection':
          if(selectionKeys.includes(targetKey))
          {
              layerToSelect.setVisible(false);
              selectionKeys = selectionKeys.filter(a => a != targetKey);
          }
          break;
        case 'polyselective':
        case 'polyselection':
          if(selectionKeys.includes(targetKey))
          {
            layerToSelect.setVisible(false);
            selectionKeys = selectionKeys.filter(a => a != targetKey);
          }
          break;

        default: console.log("Unknown selection type");
      }

      
      category.set('selection_keys', selectionKeys);
    }
  }

  toggleSelectedThemes(data) {
    if (!data)
      return;
    let self = this;
    let map = this.core.getMap();
    data.forEach(datum => {
      let category =
        map
          .getLayers()
          .getArray()
          .find(l => l.get('id') === datum.category_key);

      let layers = category.getLayers().getArray();

      self.setLayerVisibilities(datum.selection, layers);
    });

    this.lastState = data;
  }

  setLayerVisibilities(selection, layers) {
    let toggleLayer = function (layer, isMatch) {
      if (layer instanceof LayerGroup) {
        layer.setVisible(isMatch);
        layer.getLayers().getArray().forEach(child => child.setVisible(isMatch));
      } else {
        layer.setVisible(isMatch);
      }
    };

    switch (selection.selection_type) {
      case "monoselective":
      case "monoselection":
        layers.forEach(layer => {
          toggleLayer(layer, selection.selection_key === layer.get('id'));
        });
        break;
      case "polyselective":
      case "polyselection":
        layers.forEach(layer => {
          toggleLayer(layer, selection.selection_keys.includes(layer.get('id')));
        });
        break;

      default:
        break;
    }
  }

  setCategoryTransparency(data) {
    let map = this.core.getMap();
    let category =
      map
        .getLayers()
        .getArray()
        .find(l => l.get('id') === data.category_key);
    if (category) {
      category.setOpacity(data.transparency);
    }
  }

  makeLayer(data) {
    // finalizes layer as either a layer group if it has multiple
    // endpoints or as a single layer if it only has one endpoint
    let groupLayers = function (layers) {
      if (layers.length > 1) {
        let group = new LayerGroup({ layers: layers });
        group.set('id', data.key);
        window.layerMap[data.key] = group;
        return group;
      } else if (layers.length === 1) {
        layers[0].set('id', data.key);
        window.layerMap[data.key] = layers[0];
        return layers[0];
      } else {
        throw new Error(`Could not make layer for ${data.key}`);
      }
    };

    try {
      let self = this;
      let core = this.core;
      let layers = null;

      switch (data.config.type) {
        case "mvt":
          layers = mvt.generate(data, core);
          return groupLayers(layers);
        case "xyz":
          layers = data.config.value.endpoints.map(endpoint => {
            let lyr = new TileLayer({
              visible: false,
              preload: 4,
              zIndex: endpoint.zIndex || 0,
              opacity: data.opacity || 1,
              source: new XYZ({
                crossOrigin: 'anonymous',
                url: endpoint.url,
                maxZoom: data.config.value.maxZoom || 26,
                minZoom: data.config.value.minZoom || 1,
                tileLoadFunction: (imageTile, src) => {
                  imageTile.getImage().src = src;
                }
              })
            });
            lyr.set('id', data.key);
            lyr.set('name', data.name);
            return lyr;
          });

          return groupLayers(layers);

        case "wmts":
          var projection = get("EPSG:3857"),
            projectionExtent = projection.getExtent(),
            size = getWidth(projectionExtent) / 256,
            zooms = 15 + 1,
            resolutions = new Array(zooms),
            matrixIds = new Array(zooms);
          for (let z = 0; z < zooms; ++z) {
            resolutions[z] = size / Math.pow(2, z);
            matrixIds[z] = z;
          }

          layers = data.config.value.endpoints.map(endpoint => {
            let source = new WMTS({
              crossOrigin: 'anonymous',
              matrixSet: 'webmercator',
              format: 'image/png',
              projection: projection,
              requestEncoding: 'REST',
              tileGrid: new WMTSTileGrid({
                extent: data.config.value.extent,
                resolutions: resolutions,
                matrixIds: matrixIds
              }),
              style: 'default',
              opaque: false,
              transparent: true
            });
            let configureSource = function (tokenKey) {
              if (core.services && core.services[tokenKey]) {
                let tokenData = core.services[tokenKey];
                source.setUrl(`${tokenData.baseUrl || ""}${endpoint.url}`);
                source.setTileLoadFunction(function (imageTile, src) {
                  imageTile.getImage().src = `${src}?token=${tokenData.token || ""}`;
                });
              }
            }

            if (endpoint.tokenKey) {
              // if the token data has already been fetched and stored in core.services
              // go ahead and configure the source w/ the data, otherwise, postpone
              // the configuration until `setServicesCmd` has been triggered
              if (core.services && core.services[endpoint.tokenKey]) {
                configureSource(endpoint.tokenKey);
              } else {
                self.pendingConfiguration.push({
                  name: data.key,
                  fn: configureSource,
                  params: [endpoint.tokenKey]
                });
              }
            }

            let lyr = new TileLayer({
              visible: false,
              preload: 4,
              zIndex: endpoint.zIndex || 0,
              opacity: data.opacity || 1,
              source: source,
              opaque: false
            });
            lyr.set('id', data.key);
            lyr.set('name', data.name);
            return lyr;
          });

          return groupLayers(layers);

        case "wms":
          var projection = proj.get("EPSG:3857"),
            projectionExtent = projection.getExtent(),
            size = getWidth(projectionExtent) / 256,
            zooms = 15 + 1,
            resolutions = new Array(zooms);
          for (let z = 0; z < zooms; ++z) {
            resolutions[z] = size / Math.pow(2, z);
          }

          layers = data.config.value.endpoints.map(endpoint => {
            //The random adds a random value to the parameter
            //essentually cache busting  
            let customParams = {
              get random() {
                return Math.random();
              }
            };

            let source = new ImageWMS({
              params: { 'LAYERS': 'geonode:shapes' },
              ratio: 1,
              serverType: 'geoserver',
              resolutions: resolutions,
              projection: projection
            });

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

            if (endpoint.tokenKey) {
              // if the token data has already been fetched and stored in core.services
              // go ahead and configure the source w/ the data, otherwise, postpone
              // the configuration until `setServicesCmd` has been triggered
              if (core.services && core.services[endpoint.tokenKey]) {
                configureSource(endpoint.tokenKey);
              } else {
                self.pendingConfiguration.push({
                  name: data.key,
                  fn: configureSource,
                  params: [endpoint.tokenKey]
                });
              }
            }

            let lyr = new ImageLayer({
              zIndex: endpoint.zIndex || 0,
              extent: data.config.value.extent,
              source: source
            });
            lyr.set('id', data.key);
            lyr.set('name', data.name);
            return lyr;
          })

          return groupLayers(laeyrs);

        case "esriMapService":
        case "esriExport":
          layers = data.config.value.endpoints.map(endpoint => {
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

            let source = new TileArcGISRest({
              crossOrigin: 'anonymous',
              ratio: 1,
              maxZoom: 26,
              tileLoadFunction: (image, src) => {
                image.getImage().src = src;
              },
              tileGrid: tileGrid
              // tileGrid: new TileGrid(
              //     { tileSize:[2048,2048]
              //       , resolutions:[]

              //       , extent: data.config.value.extent
              //     }
              //     )
            });


            let lyr = new TileLayer({
              visible: false,
              preload: 4,
              zIndex: endpoint.zIndex || 0,
              opacity: data.opacity || 1,
              source: source,
              extent: data.config.value.extent
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

            if (endpoint.tokenKey) {
              // if the token data has already been fetched and stored in core.services
              // go ahead and configure the source w/ the data, otherwise, postpone
              // the configuration until `setServicesCmd` has been triggered
              if (core.services && core.services[endpoint.tokenKey]) {
                configureSource(endpoint.tokenKey);
              } else {
                self.pendingConfiguration.push({
                  name: data.key,
                  fn: configureSource,
                  params: [endpoint.tokenKey]
                });
              }
            }
            else {
              source.setUrl(endpoint.url);
              source.params_ = customParams;
            }
            return lyr;
          });

          return groupLayers(layers);
        
        case "esriFeatureService":
        case "esriFeature":
            layers = data.config.value.endpoints.map(endpoint => {
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
                      console.log("Cant find mapped value for " + feature.get(endpoint.styleCache.field))
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


              window.fetch(endpoint.url + "?f=json")
                .then(resp => { return resp.json() } )
                .then(meta => {
                  var rend = (meta && meta.drawingInfo ? meta.drawingInfo.renderer : {}) || {} ;
                  var field = rend.field1;
                  endpoint.styleCache.field = field;
                  endpoint.styleCache.map = {};
                  for(var inf of rend.uniqueValueInfos)
                  {
                    var sym = inf.symbol;
                    endpoint.styleCache.map[inf.value] =
                      new Style({
                        fill: new Fill({
                          color: `rgba(${sym.color[0]},${sym.color[1]},${sym.color[2]},${sym.color[3]/255})`
                        }),
                        stroke: new Stroke({
                          color: `rgba(${sym.outline.color[0]},${sym.outline.color[1]},${sym.outline.color[2]},${sym.outline.color[3]/255})`,
                          width: sym.outline.width || 4
                        })
                      })
                  }
                })
  
              let source = new VectorSource({
                loader: function (extent, resolution, projection) {
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
                    '&geometryType=esriGeometryEnvelope&inSR=102100&outFields=*' +
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
                  );
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
              return lyr;
            });
  
            return groupLayers(layers);

        default:
          throw new Error(`Layer type '${data.config.type}' has not been implemented.`);
      }
    }
    catch (err) {
      debugger;
      console.error(err);
    }

  }
  render() { }
}
