import { Group as LayerGroup, Tile as TileLayer } from "ol/layer.js";
import XYZ from "ol/source/XYZ";
import { get } from "ol/proj";
import { getWidth } from "ol/extent";
import WMTS from "ol/source/WMTS";
import WMTSTileGrid from "ol/tilegrid/WMTS";
import ImageWMS from 'ol/source/ImageWMS.js';
import ImageLayer from "ol/layer/Image";

import * as mvt from './mvt'
import * as esriExport from './esriExport'
import * as esriFeature from './esriFeature'
import * as staticVector from './staticVector'

import {getLogger} from './logger'


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
  }

  processPending() {
    let self = this;
    this.pendingConfiguration.forEach(item => {
      item.fn.apply(self, item.params);
    });
  }
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

  makeGroup(groupConfig, layerRepository) {

    let neededLayerKeys = groupConfig.layers.map(layer => {
      return layer.key;
    });

    let layers = layerRepository.filter(lyr => {
      return neededLayerKeys.includes(lyr.key);
    })

    let groupGroup = new LayerGroup({
      opacity: isNaN(groupConfig.opacity) || groupConfig.opacity == null ? 1 : groupConfig.opacity,
      layers: layers
    });

    groupGroup.name = groupConfig.name;
    groupGroup.key = groupConfig.key || groupConfig.group_key;
    groupGroup.type = "group";
    groupGroup.opacity = isNaN(groupConfig.opacity) || groupConfig.opacity == null ? 1 : groupConfig.opacity;
    groupGroup.getLayerByKey = this.getLayerByKey(groupGroup);
    groupGroup.layers = layers;

    let oldSetOpacity = groupGroup.setOpacity;
    groupGroup.setOpacity = function(opacity) {
      if(oldSetOpacity)
        oldSetOpacity.call(groupGroup, opacity);
      else
        this.getLayers().getArray().forEach(layer => {
          layer.setOpacity(opacity);
        });

      this.opacity = opacity;
    };

    let oldSetVisibility = groupGroup.setVisibility;
    groupGroup.setVisible = function(visible) {
      if(oldSetVisibility)
        oldSetVisibility.call(groupGroup, visible);
      else
        this.getLayers().getArray().forEach(layer => {
          layer.setVisible(visible);
        });
    };

    groupGroup.getLayerByKey = function(key) {
      let matchingLayers = groupGroup.getLayers().getArray().filter(layer => {
        return layer.metadata ? layer.metadata.key === key : layer.key === key;
      });

      if(matchingLayers)
        return matchingLayers[0];
    };

    return groupGroup;
  }

  makeCategory(category) {
    getLogger()("Make Category", category);

    const select = category.selection;

    // Special handling in the event a mono selection type's selection_key was saved into selection_keys array.
    const isMono = select.selection_type === 'monoselection' || select.selection_type === 'monoselective';
    if (isMono && !select.selection_key && Array.isArray(select.selection_keys)) {
      select.selection_key = select.selection_keys[select.selection_keys.length - 1];
    }
    let selectionKeys = select.selection_key ? [ select.selection_key ] : select.selection_keys;

    let layers = [];
    if(category.layers)
    {
      layers = category.layers.map(layer => {
        let lyr = this.makeLayer(layer);
        if(!lyr.getAttributions) {
          lyr.getAttributions = function() {
            return lyr.get('attributions') || '';
          }
        }
        if(selectionKeys.includes(layer.key))
          lyr.setVisible(true);

        return lyr;
      });
    }

    // show layers that are part of current selection
    // and hide ones that are not part of current selection
    this.setLayerVisibilities(select, layers);

    // group category layers into a layer group
    let categoryGroup = new LayerGroup({
      opacity: isNaN(category.opacity) || category.opacity == null ? 1 : category.opacity,
      layers: layers
    });
    categoryGroup.metadata =
      { key : category.category_key,
        name: category.category_name
      };
      categoryGroup.set('id', category.category_key);
      categoryGroup.set('selection_type', select.selection_type)
      categoryGroup.set('selection_keys', selectionKeys)
      categoryGroup.selectLayer = this.selectLayer(categoryGroup)
      categoryGroup.deselectLayer = this.deselectLayer(categoryGroup)
      categoryGroup.getLayerByKey = this.getLayerByKey(categoryGroup);

    // This is the new metadata for the category

    categoryGroup.key = category.category_key;
    categoryGroup.name = category.name;

    categoryGroup.transparency = categoryGroup.getOpacity();
    categoryGroup.getAttributions = () => { return null; }

    let oldSetOpacity = categoryGroup.setOpacity;
    categoryGroup.setOpacity = function(opacity) {
      oldSetOpacity.call(categoryGroup, opacity);
      categoryGroup.transparency = opacity;
    }
    categoryGroup.setTransparancy = categoryGroup.setOpacity;
    categoryGroup.type = "category";

    categoryGroup.getSelectionType = function() {
      return select.selection_type;
    }

    categoryGroup.getSelectionKeys = function() {
      return categoryGroup.get('selection_keys');
    }

    categoryGroup.isMonoSelective = function() {
      return categoryGroup.get('selection_type') === 'monoselective' || categoryGroup.get('selection_type') === 'monoselection';
    }

    categoryGroup.isMultiphasic = function() {
      return category.multiphasic === true || category.canChangeOpacity === true;
    }

    categoryGroup.canChangeOpacity = function() {
      return category.multiphasic === true || category.canChangeOpacity === true;
    }

    /* TODO Set Groups */
    if(category.groups && category.groups.length > 0)
    {
      categoryGroup.groups = category.groups.map(group => {
        let grp = this.makeGroup(group, layers);
        grp.getAttributions = () => { return null; }
        return grp;
      });
    }

    categoryGroup.getVisibleLayers = this.getVisibleLayers(categoryGroup);

    categoryGroup.getFeaturesInView = () => {
      let features = [];
      categoryGroup.getVisibleLayers().forEach(layer => {
        if(layer.getFeaturesInView)
        {
          features = features.concat(layer.getFeaturesInView());
        }
      });
      return features;
    }

    categoryGroup.getFeaturesUnderPixel = (pixel) => {
      let features = [];
      categoryGroup.getLayers().forEach(layer => {
        if(layer.getFeaturesUnderPixel)
        {
          features = features.concat(layer.getFeaturesUnderPixel(pixel));
        }
      });
      return features;
    }

    return categoryGroup;
  }

  /*
    This converts a list of "categories" into a list of layer groups
    It also adds extensions needed to control category selection
  */
  addLayerCategories(categories) {
    getLogger()("Adding categories")
    let self = this;
    let core = this.core;
    let map = core.getMap();
    let groups = categories.map(category => {
      getLogger()("Processing", category);
      let cat = this.makeCategory(category);
      return cat;
    });
    groups.forEach(group => map.addLayer(group));
    return groups;
  }

  getLayerByKey(category) {
    return (key) => {
      let matchingLayers = category.getLayers().getArray().filter(layer => {
        if(!layer.metadata)
        {  
          getLogger()("FIX ME", layer);
          return false;
        }
        return layer.metadata.key === key;
      });
      if(matchingLayers)
        return matchingLayers[0];
    }
  }

  getVisibleLayers(category) {
    return () => {
      let matchingLayers = category.getLayers().getArray().filter(layer => {
        return layer.getVisible();
      });

      return matchingLayers;
    }
  }

  selectLayer(category) {
    return function(layerToSelect) {
      if(typeof layerToSelect == "string")
      {
        var lyrs = category.getLayers().getArray();

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
        var filt = category.getLayers().getArray().filter(a => a.get('id') == layerToSelect)
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
          if( selectionKeys.includes(targetKey))
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
      // if (layer instanceof LayerGroup) {
      //   console.log("Its a layer group folks!")
      //   layer.setVisible(isMatch);
      //   layer.getLayers().getArray().forEach(child => child.setVisible(isMatch));
      // } else {
        layer.setVisible(isMatch);
      //}
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
      if(isNaN(data.transparency) || data.transparency == null)
        data.transparency = 1;
      category.setOpacity(data.transparency);
    }
  }

  groupLayers(layerConfig, layers) {
    for(let layer of layers) {
      if(!layer.getAttributions) {
        layer.getAttributions = function() {
          return layer.get('attributions') || '';
        }
      }
    }
    if (layers.length > 1) {
      getLogger()("Grouping these layers");
      let group = new LayerGroup({ layers: layers });
      group.set('id', layerConfig.key);
      window.layerMap[layerConfig.key] = group;
      group.metadata =
        { key : layerConfig.key,
          name: layerConfig.name,
          isGroup: true
        };

      let oldVis = group.setVisible;
      let oldOpac = group.setOpacity;

      group.setVisible = function(vis) {
        getLogger()("Setting visibility of group", vis, this);
        oldVis.call(group, vis);
        this.getLayers().getArray().forEach(layer => {
          layer.setVisible(vis);
        });
      };

      group.setOpacity = function(opac) {
        getLogger()("Setting opacity on group", opac, this);
        oldOpac.call(group, opac);
        this.getLayers().getArray().forEach(layer => {
          layer.setOpacity(opac);
        });
      };

      if(layers[0].getFeaturesInView)
      {
        group.getFeaturesInView = layers[0].getFeaturesInView;
      }

      if(layers[0].getFeaturesUnderPixel)
      {
        group.getFeaturesUnderPixel = layers[0].getFeaturesUnderPixel;
      }

      let highlightLayers = layers.filter(l => l.highlight ? true : false);
      
      if(highlightLayers.length > 0)
      {
        group.highlight = (item) => {
          highlightLayers.forEach((layer) => {
            console.log("Calling highlight on layer", layer)
            layer.highlight(item);
          });
        }
      }

      let unhighlightLayers = layers.filter(l => l.unhighlight ? true : false);
      
      if(unhighlightLayers.length > 0)
      {
        group.unhighlight = (item) => {
          unhighlightLayers.forEach((layer) => {
            layer.unhighlight(item);
          });
        }
      }
      
      let unhighlightAllLayers = layers.filter(l => l.unhighlightAll ? true : false);
      
      if(unhighlightAllLayers.length > 0)
      {
        group.unhighlightAll = () => {
          unhighlightAllLayers.forEach((layer) => {
            layer.unhighlightAll();
          });
        }
      }

      group = this.applyLayerMetadataFromConfig(group, layerConfig);

      return group;
    } else if (layers.length === 1) {
      layers[0].set('id', layerConfig.key);
      window.layerMap[layerConfig.key] = layers[0];
      
      layers[0] = this.applyLayerMetadataFromConfig(layers[0], layerConfig);

      return layers[0];
    } else {
      throw new Error(`Could not make layer for ${layerConfig.key}`);
    }
  };

  applyLayerMetadataFromConfig(layer, layerConfig) {
    layer.metadata = layer.metadata || {};
    
    layer.metadata.key = layerConfig.key;
    layer.key = layerConfig.key;

    layer.metadata.name = layerConfig.name;
    layer.name = layerConfig.name;

    layer.metadata.type = "layer";
    layer.type = "layer";

    return layer;
  }

  makeLayer(layerConfig) {
    getLogger()("Make layer", layerConfig);
    // finalizes layer as either a layer group if it has multiple
    // endpoints or as a single layer if it only has one endpoint

    try {
      let self = this;
      let core = this.core;
      let layers = null;
      let layerType = layerConfig.config.type.toLowerCase();

      getLogger()("Processing a layer with type", layerType);

      switch (layerType) {
        case "mvt":
          layers = mvt.generate(layerConfig, core);
          return this.groupLayers(layerConfig, layers);
        case "staticvector":
          layers = staticVector.generate(layerConfig, core);
          return this.groupLayers(layerConfig, layers);
        case "xyz":
          getLogger()(layerConfig.config.value.endpoints);
          layers = layerConfig.config.value.endpoints.map(endpoint => {
            let lyr = new TileLayer({
              visible: false,
              preload: 4,
              zIndex: endpoint.zIndex || 0,
              opacity: isNaN(layerConfig.opacity) || layerConfig.opacity == null ? 1 : layerConfig.opacity,
              source: new XYZ({
                crossOrigin: 'anonymous',
                url: endpoint.url,
                maxZoom: layerConfig.config.value.maxZoom || 26,
                minZoom: layerConfig.config.value.minZoom || 1,
                tileLoadFunction: (imageTile, src) => {
                  imageTile.getImage().src = src;
                }
              })
            });
            lyr.set('id', layerConfig.key);
            lyr.set('name', layerConfig.name);
            return lyr;
          });

          return this.groupLayers(layerConfig, layers);

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

          layers = layerConfig.config.value.endpoints.map(endpoint => {

            let errors = [];
            if(!endpoint.url || endpoint.url.indexOf("{TileMatrixSet}") == -1)
            {
              errors.push("Missing \"{TileMatrixSet}\" in WMTS endpoint");
            }
            if(!endpoint.url || endpoint.url.indexOf("{TileMatrix}") == -1)
            {
              errors.push("Missing \"{TileMatrix}\" in WMTS endpoint");
            }
            if(!endpoint.url || endpoint.url.indexOf("{TileRow}") == -1)
            {
              errors.push("Missing \"{TileRow}\" in WMTS endpoint");
            }
            if(!endpoint.url || endpoint.url.indexOf("{TileCol}") == -1)
            {
              errors.push("Missing \"{TileCol}\" in WMTS endpoint");
            }
            if(errors.length > 0)
            {
              console.error("Errors in WMTS endpoint", errors);
            }

            let source = new WMTS({
              crossOrigin: 'anonymous',
              matrixSet: 'webmercator',
              format: 'image/png',
              projection: projection,
              requestEncoding: 'REST',
              tileGrid: new WMTSTileGrid({
                extent: layerConfig.config.value.extent,
                resolutions: resolutions,
                matrixIds: matrixIds
              }),
              style: 'default',
              opaque: false,
              transparent: true,
              url: endpoint.url
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
                  name: layerConfig.key,
                  fn: configureSource,
                  params: [endpoint.tokenKey]
                });
              }
            }

            let lyr = new TileLayer({
              visible: false,
              preload: 4,
              zIndex: endpoint.zIndex || 0,
              opacity: isNaN(layerConfig.opacity) || layerConfig.opacity == null ? 1 : layerConfig.opacity,
              source: source,
              opaque: false
            });
            lyr.set('id', layerConfig.key);
            lyr.set('name', layerConfig.name);
            return lyr;
          });

          return this.groupLayers(layerConfig, layers);

        case "wms":
          var projection = proj.get("EPSG:3857"),
            projectionExtent = projection.getExtent(),
            size = getWidth(projectionExtent) / 256,
            zooms = 15 + 1,
            resolutions = new Array(zooms);
          for (let z = 0; z < zooms; ++z) {
            resolutions[z] = size / Math.pow(2, z);
          }

          layers = layerConfig.config.value.endpoints.map(endpoint => {
            //The random adds a random value to the parameter
            //essentially cache busting
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
              projection: projection,
              url: endpoint.url
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
                  name: layerConfig.key,
                  fn: configureSource,
                  params: [endpoint.tokenKey]
                });
              }
            }

            let lyr = new ImageLayer({
              zIndex: endpoint.zIndex || 0,
              extent: layerConfig.config.value.extent,
              source: source
            });
            lyr.set('id', layerConfig.key);
            lyr.set('name', layerConfig.name);
            return lyr;
          })

          return this.groupLayers(layerConfig, layers);

        case "esrimapservice":
        case "esriexport":
          layers = esriExport.generate(layerConfig,core);
          return this.groupLayers(layerConfig, layers);

        case "esrifeatureservice":
        case "esrifeature":
            layers = esriFeature.generate(layerConfig, core);
            return this.groupLayers(layerConfig, layers);

        default:
          throw new Error(`Layer type '${layerConfig.config.type}' has not been implemented.`);
      }
    }
    catch (err) {
      debugger;
      console.error("Error processing layer", layerConfig);
      console.error(err);
    }

  }
}

