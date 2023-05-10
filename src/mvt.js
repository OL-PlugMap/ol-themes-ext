import VectorTileLayer from 'ol/layer/VectorTile';
import { Group as LayerGroup } from "ol/layer.js";
import VectorLayer from 'ol/layer/Vector';

import VectorTileSource from 'ol/source/VectorTile';

import { Cluster } from 'ol/source';

import MVT from 'ol/format/MVT';

import { ConfigurableStyle } from './vectorStyles'
import { getLogger } from './logger';

import { _buildEngine } from './filterEngine'

import TileState from 'ol/TileState'

import * as identifyUtils from './identifyUtils'


let getId = (feature) => {
  getLogger()("Getting id from", feature)
  let featureId = -1;
  if (isNaN(feature)) {
    getLogger()("Feature isnan", feature)
    if (feature.properties_) {
      featureId = feature.get("iso_a3") || feature.getId() || feature.id_;
      getLogger()("Got id", featureId)
    }
    else {
      getLogger()("Halp");
    }
  }
  else {
    getLogger()("Feature is a number", feature);
    featureId = feature;
  }
  getLogger("Returning id for feature", featureId);
  return featureId;
}

let _unhighlight = (source) => {
  return (feature) => {
    delete source.highlightFeats[getId(feature)];
    source.changed();
  };
};

let _unhighlightAll = (source) => {
  return () => {
    source.highlightFeats = [];
    source.changed();
  };
};

let _highlight = (source) => {
  source.highlightFeats = {};
  return (feature) => {
    getLogger()("Highlighting", feature);

    source.highlightFeats[getId(feature)] = true;
    source.changed();
  };
};

let _refreshFunction = (source) => {
  return () => {
    source.changed();
    source.refresh();
  };
};


let _loader = (endpoint) => {
  return function (tile, url) {
    getLogger()("Loader", tile, url);
    tile.setLoader(function (extent, resolution, projection) {
      {
        tile.setState(TileState.LOADING);
        tile.status__ = "loading"
        const xhr = new XMLHttpRequest();
        xhr.open(
          'GET',
          typeof url === 'function' ? url(extent, resolution, projection) : url,
          true
        );
        for (let header in endpoint.headers) {
          xhr.setRequestHeader(header, endpoint.headers[header]);
        }

        xhr.responseType = 'arraybuffer';

        xhr.withCredentials = false;

        /**
         * @param {Event} event Event.
         * @private
         */
        xhr.onload = function (event) {
          let format = tile.getFormat();
          // status will be 0 for file:// urls
          if (!xhr.status || (xhr.status >= 200 && xhr.status < 300)) {
            const type = format.getType();
            /** @type {Document|Node|Object|string|undefined} */
            let source;
            source = /** @type {ArrayBuffer} */ (xhr.response);

            if (source) {
              let feats = [];
              try {
                feats = format.readFeatures(source, {
                  extent: extent,
                  featureProjection: projection,
                })
              } catch (e) {
                getLogger()("Tile failed to load", e, tile, url);
              }
              tile.onLoad(
                /** @type {Array<import("./Feature.js").default>} */
                (feats
                ),
                format.readProjection(source)
              );

              tile.setState(TileState.LOADED);
              tile.status__ = "loaded"
            } else {
              tile.setState(TileState.ERROR);
              tile.onError();
              tile.status__ = "error"
            }
          } else {
            tile.setState(TileState.ERROR);
            tile.onError();
            tile.status__ = "error"
          }
        };
        /**
         * @private
         */
        xhr.onerror = function () {
          tile.setState(TileState.ERROR);
          tile.status__ = "error";
          tile.onError()
        };
        xhr.send();
      }
    })
  }
}

let _onFeatureLoad = (source) => {
  return (featureFunction) => {
    source.on('tileloadend', tileLoadInfo => {
      try {
        featureFunction(tileLoadInfo.tile.features_);
      }
      catch (e) {
        getLogger()("Error in feature function", e);
      }
    });
  }
}

let _getFeaturesInView = (vtLayer, endpoint, map) => {
  if (endpoint.identify) {
    return identifyUtils.getFeaturesInView(vtLayer, endpoint, map);
  }
 
  return null;
};

let _getLoadingPromise = (vtLayer) => {
  return () => {
    return getLoadingPromise(vtLayer);
  }
}

let getLoadingPromise = (vtLayer) => {
  let resolve_, reject_ = null;
  let promise = new Promise((resolve, reject) => {
    resolve_ = resolve; reject_ = reject;
  });

  if (!vtLayer.loadPromiseResolves)
    vtLayer.loadPromiseResolves = [];
  vtLayer.loadPromiseResolves.push(resolve_);

  setTimeout(() => {
    if (!isLoadingTiles(vtLayer.getSource())) {
      resolve_("Not Loading");
    }
  }, 150);


  return promise;
}

let _getFeaturesUnderPixel = (vtLayer, endpoint, map) => {

  if (endpoint.identify) {
    return identifyUtils.getFeaturesUnderPixel(vtLayer, endpoint, map);
  }

};


//TODO: Make a function that, if tiles are loaded installs a promise
//Change the below to check if the promise(s) exist
//When they exist and load has finished then resolve them

let isLoadingTiles = (source) => {
  let numLoading = source.sourceTileCache.getValues().filter(tile => { return tile.status__ == "loading" }).length;
  getLogger()("Loading", numLoading);
  return numLoading > 0;
}

let handlePostRender = (source, vtLayer) => {

  vtLayer.loadPromise = new Promise((resolve, reject) => {
    vtLayer.loadPromiseResolve = resolve;
    vtLayer.loadPromiseReject = reject;
  });

  return (evt) => {
    let loadingTiles = source.sourceTileCache.getValues().filter(tile => { return tile.status__ == "loading" });
    let loadingTilesCount = loadingTiles.length;

    if (loadingTilesCount > 0) {
      //Still loading
    }
    else {
      //Loaded! Fire the loaded promise 
      if (vtLayer.loadPromiseResolves) {
        vtLayer.loadPromiseResolves.forEach(resolve => {
          resolve("Looded")
        });
        vtLayer.loadPromiseResolves = null;
      }
    }
  }
}

export const generate = (data, core) => {
  let layers = data.config.value.endpoints.map(endpoint => {
    let url = endpoint.url;

    let source = new VectorTileSource({
      maxZoom: 15,
      format: new MVT({
        idProperty: endpoint.idField || 'id'
      }),
      tileSize: endpoint.tileSize === undefined ? 256 : endpoint.tileSize,
      url: url
    });

    if (endpoint.headers) {
      let loader = _loader(endpoint);

      source.setTileLoadFunction(loader);
    }

    let vtLayer = new VectorTileLayer({
      declutter: data.config.value.declutter === true,
      source: source,
      zIndex: endpoint.zIndex || 1000,
    });

    let moo = new ConfigurableStyle(endpoint, source, vtLayer);
    
    vtLayer.style = moo.getStyle;
    vtLayer.setStyle(moo.getStyle)
    vtLayer.getLegend = async () => { return moo.getLegend };

    vtLayer.set('id', data.key);

    vtLayer.refreshFunction = _refreshFunction(source);

    vtLayer.highlight = _highlight(source);

    vtLayer.unhighlight = _unhighlight(source);

    vtLayer.unhighlightAll = _unhighlightAll(source);

    vtLayer.filter = _buildEngine(source, vtLayer);

    vtLayer.filterEngine = null;

    vtLayer.getLoadingPromise = _getLoadingPromise(vtLayer);

    vtLayer.getFeaturesInView = _getFeaturesInView(vtLayer, endpoint, core.getMap())

    vtLayer.getFeaturesUnderPixel = _getFeaturesUnderPixel(vtLayer, endpoint, core.getMap());
    
    vtLayer.onFeatureLoad = _onFeatureLoad(source);

    if (endpoint.hasOwnProperty("zoom") && endpoint.zoom.hasOwnProperty("min")) {
      console.log("Setting min zoom", endpoint.zoom.min);
      vtLayer.setMinZoom(endpoint.zoom.min);
    }

    if (endpoint.hasOwnProperty("zoom") && endpoint.zoom.hasOwnProperty("max")) {
      console.log("Setting max zoom", endpoint.zoom.max);
      vtLayer.setMaxZoom(endpoint.zoom.max);
    }

    vtLayer.on('postrender', handlePostRender(source, vtLayer));
    source.on('tileloadend', handlePostRender(source, vtLayer));
    source.on('tileloaderror', handlePostRender(source, vtLayer));

    if (data.config.value.cluster && data.config.value.cluster.enabled) {
      const clusterSource = new Cluster({
        distance: data.config.value.cluster.distance,
        minDistanc: data.config.value.cluster.minDistance,
        source: source,
      });

      const clusters = new VectorLayer({
        source: clusterSource,
        style: function (feature) {
          const size = feature.get('features').length;
          let style = styleCache[size];
          if (!style) {
            style = new Style({
              image: new CircleStyle({
                radius: 10,
                stroke: new Stroke({
                  color: '#fff',
                }),
                fill: new Fill({
                  color: '#3399CC',
                }),
              }),
              text: new Text({
                text: size.toString(),
                fill: new Fill({
                  color: '#fff',
                }),
              }),
            });
            styleCache[size] = style;
          }
          return style;
        },
      });

      let group = new LayerGroup({ layers: [vtLayer, clusters] });

      let oldVis = group.setVisible;
      let oldOpac = group.setOpacity;

      group.setVisible = function (vis) {
        oldVis.call(group, vis);
        this.getLayers().getArray().forEach(layer => {
          layer.setVisible(vis);
        });
      };

      group.setOpacity = function (opac) {
        oldOpac.call(group, opac);
        this.getLayers().getArray().forEach(layer => {
          layer.setOpacity(opac);
        });
      };


      vtLayer = group;
    }

    

    return vtLayer;
  });

  // Determine if any of the layers has a legend
  let hasLegend = layers.some(layer => {
    return layer.getLegend() !== null;
  });

  // If we have a legend, create a legend control
    
  return layers;
}