import VectorTileLayer from 'ol/layer/VectorTile';
import { Group as LayerGroup } from "ol/layer.js";
import VectorLayer from 'ol/layer/Vector';

import VectorTileSource from 'ol/source/VectorTile';

import {Cluster, Vector as VectorSource} from 'ol/source';

import MVT from 'ol/format/MVT';

import { ConfigurableStyle } from './vectorStyles'
import { getLogger } from './logger';

import { _buildEngine } from './filterEngine'


let _filterEngine = (source) => {
  (feature) => {
    getLogger()("Filter Engine Old");
    var renderFeature = true;
    var fev =
    {
      render: false
      , renderFn: function () { return false; }
      , filtersRan: false
      , filtersChecked: {}
    }

    if (source.filter) {
      fev.filtersRan = true;
      renderFeature = true;
      var keys = Object.keys(source.filter);
      keys.forEach(key => {
        getLogger()("Applying", key, source.filter[key]);
        var filterResult =
        {
          checked: true
          , result: false
          , valuesChecked: {}
        }

        var valuesMet = [];
        source.filter[key].values.forEach(value => {
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


        var renderThisFeature = false || source.filter[key].values.length == 0;

        if (source.filter[key].mode == "OR") {
          valuesMet.forEach(value => {
            renderThisFeature = renderThisFeature || value;
          })
        }

        if (source.filter[key].mode == "AND") {
          var renderThisFeature = true;
          valuesMet.forEach(value => {
            renderThisFeature = renderThisFeature && value;
          })
        }

        filterResult.result = renderThisFeature;

        fev.filtersChecked[key] = filterResult;



        //feature.properties_["FilterEngine_" + key + "_render"] = renderThisFeature
        if (source.filterMode == "AND")
          renderFeature = renderFeature && renderThisFeature;
        else
          renderFeature = renderFeature || renderThisFeature;
      })

    }

    fev.renderFn = function () {
      let flt = source.filter;
      let filterSets = Object.keys(flt);
      let render = true;

      if (source.filterMode == "AND") {
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

        if (source.filterMode == "AND") {
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
  };
}





/**
 * Applies filter definitions to a VectorTile source and layer.
 *
 * This function returns a handler that can be called with a `layerset` object containing filter definitions.
 * It updates the source's filter state and toggles the layer's visibility based on whether any filters are applied.
 *
 * @param {ol/source/VectorTile} source - The vector tile source to apply filters to.
 * @param {ol/layer/VectorTile} vtLayer - The vector tile layer whose visibility may be toggled.
 * @returns {Function} A function that takes a `layerset` object and applies the filters.
 *
 * Example usage:
 * ```js
 * // Assume vtLayer is a VectorTileLayer and source is its VectorTileSource
 * const layerset = {
 *   filts: [
 *     {
 *       layerid: 'myLayer',
 *       values: [
 *         { applied: true, filter: { all: [{ field: 'foo', values: { exact: 'bar' } }] } }
 *       ],
 *       mode: 'AND'
 *     }
 *   ],
 *   mode: 'AND'
 * };
 * vtLayer.applyFilters(layerset);
 * ```
 */
let _applyFilters = (source, vtLayer) => {
  //TODO: Can we interpret vtLayer or source based off the other?
  return (layerset) => {
    if (!source.filter)
    source.filter = {};

    if (Array.isArray(layerset.filts)) {
      layerset.filts.forEach(lyr => {
        //todo remove the test 
        source.filter['test_' + lyr.layerid] = lyr;
      })
    }

    source.filterMode = layerset.mode;

    var epk = Object.keys(source.filter)

    var anyApplied = false;

    for (var i = 0; i < epk.length && !anyApplied; i++) {
      var f = source.filter[epk[i]];
      for (var v = 0; v < f.values.length && !anyApplied; v++) {
        anyApplied = anyApplied || f.values[v].applied
      }
    }

    if (source.inview)
      vtLayer.setVisible(true);

    if (anyApplied) {
      if (!source.inview)
        vtLayer.setVisible(true);
      //this.changed();
    }
    else {
      if (!source.inview)
        vtLayer.setVisible(false);
      //this.changed();
    }


  };
};


let _clearFilters = (source) => {
  (layer) => {
    if (!source.filter)
    source.filter = {};
    delete endpoint.filter['test_' + layer.layerid];

    if (Object.keys(source.filter).length == 0) {
      vtLayer.setVisible(false);
    }

    this.changed();
  };
};


let getId = (feature) => {
  getLogger()("Getting id from", feature)
  let featureId = -1;
    if(isNaN(feature))
    {
      getLogger()("Feature isnan", feature)
      if(feature.properties_)
      {
        featureId = feature.get("iso_a3"); //TODO
        getLogger()("Got id", featureId)
      }
      else
      {
        getLogger()("Halp");
      }
    }
    else
    {
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

let _refreshFunction = (source) =>
{
  return () => {
    source.changed();
    source.refresh();
  };
};

let _loaderOld = (endpoint) => {
  return function(tile, url) {
    getLogger()("Loader", tile, url);
    tile.setLoader(function(extent, resolution, projection, onSuccess, onError) {
      tile.status__ = "loading";
      var fetchModel =
        {
          method: 'GET',
          mode: 'cors',
          headers: endpoint.headers
        };
      if(endpoint.nocache)
      {
        fetchModel.cache = 'no-cache';
      }
      
      getLogger()("Fetching", url);
      return fetch(url, fetchModel).then(function(response) {
        
        return response.arrayBuffer().then(function(data) {
          try
          {
            const format = tile.getFormat()
            const features = format.readFeatures(data, {
              extent: extent,
              featureProjection: projection
            });
            getLogger()("Got features", url, features);
            tile.setFeatures(features);
            onSuccess(features);
          }
          catch(ex)
          {
            getLogger()("Unable to load tile", ex, tile, url);
            tile.setFeatures([]);
            onError();
          }
        })
        .catch(ex => {
          getLogger()("Unable to get AB for tile", ex, tile, url);
          tile.setFeatures([]);
          onError();
        });
      })
      .catch(err => {
        getLogger()("Error Fetching", err);
        // In the event there is an error setting the status to error would be wise however, when a tile state is set to error the rest of the map starts doing weird things.
        tile.setFeatures([]);
        onError();
      });
    });
  }
};

let _loader = (endpoint) => {
  return function(tile, url) {
    getLogger()("Loader", tile, url);
    tile.setLoader(function(extent, resolution, projection) {
      {
        tile.status__ = "loading"
        const xhr = new XMLHttpRequest();
        xhr.open(
          'GET',
          typeof url === 'function' ? url(extent, resolution, projection) : url,
          true
        );
        for(let header in endpoint.headers)
        {
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
                ( feats
                ),
                format.readProjection(source)
              );
              
              tile.status__ = "loaded"
            } else {
              tile.onError();
              tile.status__ = "error"
            }
          } else {
            tile.onError();
            tile.status__ = "error"
          }
        };
        /**
         * @private
         */
        xhr.onerror = function() { 
          tile.status__ = "error"; 
          tile.onError()
        };
        xhr.send();
      }
    })
  }
}


let _deduplicateFeatures = (features) => {
  let rets = {};

  features.forEach((feat) => {
    rets[feat.getId()+""] = feat;
  });

  var keys = Object.keys(rets);

  var ret = [];

  keys.forEach(key => {
    ret.push(rets[key]);
  });

  return ret;
};

let _getFeaturesInView = (vtLayer, map) => {
  return async () => {
    return getLoadingPromise(vtLayer).then(async () => {
      let features = vtLayer.getFeaturesInExtent(map.getView().calculateExtent())
      
      let ret = _deduplicateFeatures(features);

      return ret;
    });
  }
};


let getLoadingPromise = (vtLayer) => {
  let resolve_, reject_ = null;
  let promise = new Promise((resolve,reject) => {
    resolve_ = resolve; reject_ = reject;
  });

  if(!vtLayer.loadPromiseResolves)
    vtLayer.loadPromiseResolves = [];
  vtLayer.loadPromiseResolves.push(resolve_);

  setTimeout(() => {
    if(!isLoadingTiles(vtLayer.getSource()))
    {
      resolve_("Not Loading");
    }
  }, 150);


  return promise;
}

let _getFeaturesUnderPixel = (vtLayer, map) => {
  return async (pixel, event) => {
    if(!pixel || !Array.isArray(pixel) || pixel.length != 2)
    {
      console.warn("Invalid parameter provided to getFeaturesUnderPixel. Expected an array with a length of 2. Got", pixel);
    }
    getLogger()("Getting features at", pixel);
    return getLoadingPromise(vtLayer).then(async () => {
      getLogger()("Loaded tiles, calling getFeatures");
      
      let coords = map.getCoordinateFromPixel(pixel);
      getLogger()("Coords", coords);

      let zoom = map.getView().getZoom();
      getLogger()("Zoom", zoom);

      let buf = (25 - zoom);

      switch(zoom)
      {
        case 1:
        case 2:
        case 3:
        case 4:
        case 5:
        case 6:
          buf = 100; break;
        case 7:
        case 8:
        case 9:
        case 10:
          buf = 50; break;
        case 11:
        case 12:
        case 13:
        case 14:
        case 15:
          buf = 20; break;
        case 16:
        case 17:
        case 18:
        case 19:
        case 20:
        case 21:
        case 22:
        case 23:
        case 24:
          buf = 10; break;
        default: buf = 1; break;
      }

      if(buf <= 0) buf = 1;
      getLogger()("buf", buf);

      let ext = [coords[0]-buf,coords[1]-buf,coords[0]+buf,coords[1]+buf]
      getLogger()("ext", ext);

      let features = vtLayer.getSource().getFeaturesInExtent(ext);
      //let features = await vtLayer.getFeatures(pixel);
      getLogger()("Got features", features);
      
      let ret = _deduplicateFeatures(features);
      getLogger()("Deduplicated", ret);

      return ret;
    });
  }
};

let _configureSource = (tokenKey) => {
  if (core.services && core.services[tokenKey]) {
    let tokenData = core.services[tokenKey];
    source.setUrl(`${tokenData.baseUrl || ""}${endpoint.url}`);
  }
};

//TODO: Make a function that, if tiles are loaded installs a promise
//Change the below to check if the promise(s) exist
//When they exist and load has finished then resolve them

let isLoadingTiles = (source) => {
  let numLoading = Object.values(source.sourceTiles_).filter(tile => { return tile.status__ == "loading" }).length;
  getLogger()("Loading", numLoading);
  return numLoading > 0;
}

let handlePostRender = (source, vtLayer) => {
  
  vtLayer.loadPromise = new Promise((resolve,reject) => {
    vtLayer.loadPromiseResolve = resolve;
    vtLayer.loadPromiseReject = reject;
  });

  return (evt) => {
    // Note this crashes in ol 10.5, todo: Fix this
    let loadingTiles = source?.sourceTileCache ? source.sourceTileCache.getValues().filter(tile => { return tile.status__ == "loading" }) : [];
    let loadingTilesCount = loadingTiles.length;

    if(loadingTilesCount > 0)
    {
      //Still loading
    }
    else
    {
      //Loaded! Fire the loaded promise 
      if(vtLayer.loadPromiseResolves)
      {
        vtLayer.loadPromiseResolves.forEach(resolve => {
          resolve("Looded")
        });
        vtLayer.loadPromiseResolves = null;
      }
    }
  }
}

export const generate = (data, core) => {
    var layers = data.config.value.endpoints.map(endpoint => {
        var url = endpoint.url;

        var source = new VectorTileSource({
          maxZoom: 15,
          format: new MVT({
            idProperty: 'id'
          }),
          tileSize: endpoint.tileSize === undefined ? 256 : endpoint.tileSize,
          url: url
        });

        if(endpoint.headers)
        {
          var loader = _loader(endpoint);

          source.setTileLoadFunction(loader);
        }

        console.log(data);
        var vtLayer = new VectorTileLayer({
          declutter: data.config.value.declutter === true,
          source: source,
          zIndex: endpoint.zIndex || 1000,
        });

        let moo = new ConfigurableStyle(endpoint, source, vtLayer);
        vtLayer.moo = moo;
        vtLayer.style = moo.getStyle;
        vtLayer.setStyle(moo.getStyle)

        vtLayer.set('id', data.key);
        
        vtLayer.refreshFunction = _refreshFunction(source);

        vtLayer.highlight = _highlight(source);

        vtLayer.unhighlight = _unhighlight(source);

        vtLayer.unhighlightAll = _unhighlightAll(source);

        vtLayer.applyFilters = _applyFilters(source, vtLayer);

        vtLayer.filter = _buildEngine(source,vtLayer);
          
        vtLayer.clearFilters = _clearFilters(source);

        vtLayer.filterEngine = _filterEngine(source);

        vtLayer.getFeaturesInView = _getFeaturesInView(vtLayer, core.getMap())

        vtLayer.getFeaturesUnderPixel = _getFeaturesUnderPixel(vtLayer, core.getMap());
      
        vtLayer.on('postrender', handlePostRender(source, vtLayer));
        source.on('tileloadend', handlePostRender(source, vtLayer));
        source.on('tileloaderror', handlePostRender(source, vtLayer));

        if(data.config.value.cluster && data.config.value.cluster.enabled)
        {
          console.log("Clistering enabled");

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

          let group = new LayerGroup({layers: [ vtLayer, clusters ]});

          let oldVis = group.setVisible;
          let oldOpac = group.setOpacity;

          group.setVisible = function(vis) {
            console.log("Setting visibility of group", vis, this);
            oldVis.call(group, vis);
            this.getLayers().getArray().forEach(layer => {
              layer.setVisible(vis);
            });
          };

          group.setOpacity = function(opac) {
            console.log("Setting opacity on group", opac, this);
            oldOpac.call(group, opac);
            this.getLayers().getArray().forEach(layer => {
              layer.setOpacity(opac);
            });
          };


          vtLayer = group;
        }

        return vtLayer;
      });

    return layers;
}

/**
 * Builder for a single endpoint configuration for MVT layers.
 *
 * Example usage:
 *   const endpoint = new MvtEndpointConfigBuilder()
 *     .setUrl('https://example.com/tiles/{z}/{x}/{y}.pbf')
 *     .setZIndex(1000)
 *     .setTileSize(256)
 *     .setHeaders({ Authorization: 'Bearer token' })
 *     .build();
 */
export class MvtEndpointConfigBuilder {
  /**
   * @param {Object} [initialEndpoint] - Optional initial endpoint configuration.
   */
  constructor(initialEndpoint = {}) {
    this._endpoint = { ...initialEndpoint };
  }

  setUrl(url) {
    this._endpoint.url = url;
    return this;
  }

  setZIndex(zIndex) {
    this._endpoint.zIndex = zIndex;
    return this;
  }

  setTileSize(tileSize) {
    this._endpoint.tileSize = tileSize;
    return this;
  }

  setHeaders(headers) {
    this._endpoint.headers = headers;
    return this;
  }

  build() {
    if (!this._endpoint.url || typeof this._endpoint.url !== 'string') {
      throw new Error('Endpoint "url" is required and must be a string.');
    }
    if (this._endpoint.zIndex && typeof this._endpoint.zIndex !== 'number') {
      throw new Error('Endpoint "zIndex" must be a number if provided.');
    }
    if (this._endpoint.tileSize && typeof this._endpoint.tileSize !== 'number') {
      throw new Error('Endpoint "tileSize" must be a number if provided.');
    }
    if (this._endpoint.headers && typeof this._endpoint.headers !== 'object') {
      throw new Error('Endpoint "headers" must be an object if provided.');
    }
    return { ...this._endpoint };
  }
}

/**
 * Builder for the MVT configuration object.
 *
 * Example usage:
 *   const config = new MvtConfigBuilder()
 *     .setKey('myLayerGroup')
 *     .setDeclutter(true)
 *     .setCluster({ enabled: true, distance: 40, minDistance: 20 })
 *     .addEndpoint(endpointConfig)
 *     .build();
 */
export class MvtConfigBuilder {
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
    };

    if (
      initialConfig.config &&
      initialConfig.config.value &&
      Array.isArray(initialConfig.config.value.endpoints)
    ) {
      this._config.config.value.endpoints = [...initialConfig.config.value.endpoints];
    }
  }

  setKey(key) {
    this._config.key = key;
    return this;
  }

  setDeclutter(declutter) {
    this._config.config.value.declutter = !!declutter;
    return this;
  }

  setCluster(clusterConfig) {
    this._config.config.value.cluster = clusterConfig;
    return this;
  }

  addEndpoint(endpoint) {
    if (!endpoint || typeof endpoint !== 'object') {
      throw new Error('Endpoint must be an object.');
    }
    this._config.config.value.endpoints.push(endpoint);
    return this;
  }

  build() {
    return this._config;
  }
}