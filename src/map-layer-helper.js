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

import VectorTileLayer from 'ol/layer/VectorTile';
import VectorTileSource from 'ol/source/VectorTile';

import {tile as tileStrategy} from 'ol/loadingstrategy';
import {createXYZ} from 'ol/tilegrid';

import MVT from 'ol/format/MVT';

import { Fill, Stroke, Style, CircleStyle } from 'ol/style';
import { applyStyle } from 'ol-mapbox-style';
import EsriJSON from 'ol/format/EsriJSON';

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

    core.mapCmd("addThemesCmd", this.addLayerCategories.bind(this));

    core.mapCmd("toggleSelectedThemesCmd", this.toggleSelectedThemes.bind(this));

    //core.mapCmd("updateLayersFiltersCmd", this.updateLayersFilters.bind(this));

    core.mapCmd("setCategoryTransparencyCmd", this.setCategoryTransparency.bind(this));

    core.on("setServicesCmd", this.processPending.bind(this));
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
    console.log("Adding layers!");

    let self = this;
    let core = this.core;
    let map = core.getMap();

    console.log("Converting config to ol layers");
    let layersMapped = layers.map(layer => {
      console.log("Making layer", layer)
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
    console.log("Setup Categories", categories)
    let self = this;
    let core = this.core;
    let map = core.getMap();
    let groups = categories.map(category => {
      console.log("Setting up category", category)
      // build out all the layers, none will be visible yet
      let layers = category.layers.map(layer => {
        console.log("Making layer", layer)
        return self.makeLayer.call(self, layer);
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
      group.set('selection_keys', category.selection.selection_key ? [ category.selection.selection_key ] : category.selection.selection_keys)
      group.selectLayer = this.selectLayer(group)
      group.deselectLayer = this.deselectLayer(group)
      return group;
    });
    groups.forEach(group => map.addLayer(group));
    return groups;
  }

  selectLayer(category) {
    console.log("Setting up select layer for", category)
    return function(layerToSelect) {

      console.log("Attempting to select", layerToSelect)

      if(typeof layerToSelect == "string")
      {
        console.log("Got a key, finding the layer");

        var lyrs = category.getLayersArray();

        console.log("All layers", lyrs);
        var filt = lyrs.filter(a => a.get('id') == layerToSelect)
        
        console.log("Found", filt)

        if(filt && filt.length)
          layerToSelect = filt[0];
        else
          console.log("Couldnt find layer by id", layerToSelect);
      }  
      let categoryId = category.get('id');
      let selectionType = category.get('selection_type');
      let selectionKeys = category.get('selection_keys');
      let targetKey = layerToSelect.get('id');

      console.log("Updating selection on category", categoryId);
      console.log("Selection Type", selectionType);
      console.log("Old Selection", selectionKeys);
      console.log("target Selection", targetKey);

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

      
      console.log("New Selection", selectionKeys);
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

      console.log("Updating selection on category", categoryId);
      console.log("Selection Type", selectionType);
      console.log("Old Selection", selectionKeys);
      console.log("target Selection", targetKey);

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

      
      console.log("New Selection", selectionKeys);
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
      case "monoselection":
        layers.forEach(layer => {
          toggleLayer(layer, selection.selection_key === layer.get('id'));
        });
        break;

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







          layers = data.config.value.endpoints.map(endpoint => {

            endpoint.highlightFeats = {};

            var filterEngine = function (feature) {
              var renderFeature = true;
              var fev =
              {
                render: false
                , renderFn: function () { return false; }
                , filtersRan: false
                , filtersChecked: {}
              }

              if (endpoint.filter) {
                fev.filtersRan = true;
                renderFeature = true;
                var keys = Object.keys(endpoint.filter);
                keys.forEach(key => {
                  var filterResult =
                  {
                    checked: true
                    , result: false
                    , valuesChecked: {}
                  }

                  var valuesMet = [];
                  endpoint.filter[key].values.forEach(value => {
                    var valueResult =
                    {
                      conditionMet: false
                    }
                    if (value.filter.all) {
                      var allMet = true;
                      value.filter.all.forEach(filter => {
                        if (!feature || !feature.properties_) {
                        }
                        if (feature.properties_[filter.field]) {
                          if (filter.values && filter.values.exact) {
                            allMet = allMet && (feature.properties_[filter.field] + "") == filter.values.exact;
                          }
                          else if (filter.values && (filter.values.greaterThan != undefined)) {
                            var value = feature.properties_[filter.field];

                            allMet = allMet && (value >= filter.values.greaterThan) && (value < filter.values.lessThan);
                          }
                          else if (filter.values && filter.values.null) {
                            allMet = allMet && (feature.properties_[filter.field] == undefined || feature.properties_[filter.field] == null)
                          }
                          else {
                            allMet = false;
                          }
                        }
                        else if (filter.values.null) {
                          allMet = true;
                        } else {
                          allMet = false;
                        }
                      });

                      valueResult.conditionMet = allMet;
                      filterResult[value.name] = valueResult;

                      //feature.properties_["FilterEngine_" + key + "_allMet_" + value.name] = allMet;

                      valuesMet.push(allMet);
                    }

                    if (value.filter.any) {
                      var allMet = false;
                      value.filter.any.forEach(filter => {
                        if (!feature || !feature.properties_) {
                        }
                        if (feature.properties_[filter.field]) {
                          if (filter.values && filter.values.exact) {
                            allMet = allMet || (feature.properties_[filter.field] + "") == filter.values.exact;
                          }
                          else if (filter.values && (filter.values.greaterThan != undefined)) {
                            var value = feature.properties_[filter.field];

                            allMet = allMet || (value >= filter.values.greaterThan) && (value < filter.values.lessThan);
                          }
                          else if (filter.values && filter.values.null) {
                            allMet = allMet || (feature.properties_[filter.field] == undefined || feature.properties_[filter.field] == null)
                          }
                          else {
                            allMet = false;
                          }
                        }
                        else if (filter.values.null) {
                          allMet = true;
                        } else {
                          allMet = false;
                        }
                      });

                      valueResult.conditionMet = allMet;
                      filterResult[value.name] = valueResult;

                      //feature.properties_["FilterEngine_" + key + "_allMet_" + value.name] = allMet;

                      valuesMet.push(allMet);
                    }

                    fev.filtersChecked[key] = filterResult;
                  });


                  var renderThisFeature = false || endpoint.filter[key].values.length == 0;

                  if (endpoint.filter[key].mode == "OR") {
                    valuesMet.forEach(value => {
                      renderThisFeature = renderThisFeature || value;
                    })
                  }

                  if (endpoint.filter[key].mode == "AND") {
                    var renderThisFeature = true;
                    valuesMet.forEach(value => {
                      renderThisFeature = renderThisFeature && value;
                    })
                  }

                  filterResult.result = renderThisFeature;

                  fev.filtersChecked[key] = filterResult;



                  //feature.properties_["FilterEngine_" + key + "_render"] = renderThisFeature
                  if (endpoint.filterMode == "AND")
                    renderFeature = renderFeature && renderThisFeature;
                  else
                    renderFeature = renderFeature || renderThisFeature;
                })

              }

              fev.renderFn = function () {
                let flt = endpoint.filter;
                let filterSets = Object.keys(flt);
                let render = true;

                if (endpoint.filterMode == "AND") {
                  render = true;
                }
                else {
                  render = false;
                }

                for (var i = 0; i < filterSets.length; i++) {
                  var filterSet = flt[filterSets[i]];

                  var match = false; // || filterSet.values.length == 0;
                  var orMode = true;

                  if (filterSet.mode == "AND") {
                    match = true;
                    orMode = false;
                  }


                  for (var t = 0; t < filterSet.values.length; t++) {
                    var value = filterSet.values[t];
                    var fc = fev.filtersChecked[filterSets[i]]
                    if (!fc) {
                      debugger;
                      //We gonna crash ... why ...
                    }
                    var condVal = fc[value.name]

                    if (value.applied) {
                      if (orMode) {
                        match = match || condVal.conditionMet;
                        if (match)
                          break;
                      }
                      else {
                        match = match && condVal.conditionMet;
                        if (!match)
                          break
                      }

                    }
                  }

                  if (endpoint.filterMode == "AND") {
                    render = render && match;
                    if (!render) {
                      break;
                    }
                  }
                  else {
                    render = render || match;
                    if (render) {
                      break;
                    }
                  }
                }
                fev.render = render;

              }

              feature.properties_["FilterEngine"] = fev;



              //feature.properties_["FilterEngine_render"] = renderFeature
              return renderFeature;
            }

            var styleFn = function (endpoint, source, layer) {

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
                  return function (feature) {

                    if (endpoint.highlightFeats[feature.properties_.id]) {
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
                    } else if (feature && feature.properties_ && feature.properties_[field]) {
                      var val = feature.properties_[field] + "";
                      if (map[val]) {
                        var style = map[val];
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

                  }
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

            var url = endpoint.url;

            var source = new VectorTileSource({
              maxZoom: 15,
              format: new MVT({
                idProperty: 'iso_a3'
              }),
              url: url
            });

            // source.on("tileloadend", evt => {
            //   var f = evt.tile.getFeatures();
            //   f.forEach(filterEngine);
            // })

            let configureSource = function (tokenKey) {
              if (core.services && core.services[tokenKey]) {
                let tokenData = core.services[tokenKey];
                source.setUrl(`${tokenData.baseUrl || ""}${endpoint.url}`);
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

            var vtLayer = new VectorTileLayer({
              declutter: true,
              source: source,
              zIndex: endpoint.zIndex || 1000

            });

            debugger;
            vtLayer.style = styleFn(endpoint, source, vtLayer);
            vtLayer.setStyle(styleFn(endpoint, source, vtLayer))

            vtLayer.set('id', data.key);
            source.refreshFunction =
              function () {
                source.changed();
                source.refresh();
              }
            console.log("Adding in the applyFilters for " + data.key)
            source.highlight =
              function (feature) {
                endpoint.highlightFeats[feature] = true;
                this.changed();
              }

            source.unhighlight =
              function (feature) {
                delete endpoint.highlightFeats[feature];
                this.changed();
              }


            source.applyFilters =
              function (layerset) {
                if (!endpoint.filter)
                  endpoint.filter = {};

                if (Array.isArray(layerset.filts)) {
                  layerset.filts.forEach(lyr => {
                    //todo remove the test 
                    endpoint.filter['test_' + lyr.layerid] = lyr;
                  })
                }

                endpoint.filterMode = layerset.mode;

                var epk = Object.keys(endpoint.filter)

                var anyApplied = false;

                for (var i = 0; i < epk.length && !anyApplied; i++) {
                  var f = endpoint.filter[epk[i]];
                  for (var v = 0; v < f.values.length && !anyApplied; v++) {
                    anyApplied = anyApplied || f.values[v].applied
                  }
                }

                if (source.inview)
                  vtLayer.setVisible(true);

                if (anyApplied) {
                  if (!source.inview)
                    vtLayer.setVisible(true);
                  this.changed();
                }
                else {
                  if (!source.inview)
                    vtLayer.setVisible(false);
                  this.changed();
                }


              };

            source.clearFilters =
              function (layer) {
                if (!endpoint.filter)
                  endpoint.filter = {};
                delete endpoint.filter['test_' + layer.layerid];

                if (Object.keys(endpoint.filter).length == 0) {
                  vtLayer.setVisible(false);
                }

                this.changed();
              }

            source.filterEngine = filterEngine;


            

            return vtLayer;
          });
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
