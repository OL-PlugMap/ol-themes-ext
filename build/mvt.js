import VectorTileLayer from 'ol/layer/VectorTile';
import { Group } from 'ol/layer.js';
import VectorLayer from 'ol/layer/Vector';
import VectorTileSource from 'ol/source/VectorTile';
import { Cluster } from 'ol/source';
import MVT from 'ol/format/MVT';
import { ConfigurableStyle } from './vectorStyles.js';
import { getLogger } from './logger.js';
import { _buildEngine } from './filterEngine.js';

let _filterEngine = (source2) => {
};
let _applyFilters = (source2, vtLayer2) => {
  return (layerset) => {
    if (!source2.filter)
      source2.filter = {};
    if (Array.isArray(layerset.filts)) {
      layerset.filts.forEach((lyr) => {
        source2.filter["test_" + lyr.layerid] = lyr;
      });
    }
    source2.filterMode = layerset.mode;
    var epk = Object.keys(source2.filter);
    var anyApplied = false;
    for (var i = 0; i < epk.length && !anyApplied; i++) {
      var f = source2.filter[epk[i]];
      for (var v = 0; v < f.values.length && !anyApplied; v++) {
        anyApplied = anyApplied || f.values[v].applied;
      }
    }
    if (source2.inview)
      vtLayer2.setVisible(true);
    if (anyApplied) {
      if (!source2.inview)
        vtLayer2.setVisible(true);
      (void 0).changed();
    } else {
      if (!source2.inview)
        vtLayer2.setVisible(false);
      (void 0).changed();
    }
  };
};
let _clearFilters = (source2) => {
};
let getId = (feature) => {
  getLogger()("Getting id from", feature);
  let featureId = -1;
  if (isNaN(feature)) {
    getLogger()("Feature isnan", feature);
    if (feature.properties_) {
      featureId = feature.get("iso_a3");
      getLogger()("Got id", featureId);
    } else {
      getLogger()("Halp");
    }
  } else {
    getLogger()("Feature is a number", feature);
    featureId = feature;
  }
  return featureId;
};
let _unhighlight = (source2) => {
  return (feature) => {
    delete source2.highlightFeats[getId(feature)];
    source2.changed();
  };
};
let _unhighlightAll = (source2) => {
  return () => {
    source2.highlightFeats = [];
    source2.changed();
  };
};
let _highlight = (source2) => {
  source2.highlightFeats = {};
  return (feature) => {
    getLogger()("Highlighting", feature);
    source2.highlightFeats[getId(feature)] = true;
    source2.changed();
  };
};
let _refreshFunction = (source2) => {
  return () => {
    source2.changed();
    source2.refresh();
  };
};
let _loader = (endpoint2) => {
  return function(tile, url) {
    getLogger()("Loader", tile, url);
    tile.setLoader(function(extent, resolution, projection) {
      {
        tile.status__ = "loading";
        const xhr = new XMLHttpRequest();
        xhr.open(
          "GET",
          typeof url === "function" ? url(extent, resolution, projection) : url,
          true
        );
        for (let header in endpoint2.headers) {
          xhr.setRequestHeader(header, endpoint2.headers[header]);
        }
        xhr.responseType = "arraybuffer";
        xhr.withCredentials = false;
        xhr.onload = function(event) {
          let format = tile.getFormat();
          if (!xhr.status || xhr.status >= 200 && xhr.status < 300) {
            format.getType();
            let source2;
            source2 = /** @type {ArrayBuffer} */
            xhr.response;
            if (source2) {
              let feats = [];
              try {
                feats = format.readFeatures(source2, {
                  extent,
                  featureProjection: projection
                });
              } catch (e) {
                getLogger()("Tile failed to load", e, tile, url);
              }
              tile.onLoad(
                /** @type {Array<import("./Feature.js").default>} */
                feats,
                format.readProjection(source2)
              );
              tile.status__ = "loaded";
            } else {
              tile.onError();
              tile.status__ = "error";
            }
          } else {
            tile.onError();
            tile.status__ = "error";
          }
        };
        xhr.onerror = function() {
          tile.status__ = "error";
          tile.onError();
        };
        xhr.send();
      }
    });
  };
};
let _deduplicateFeatures = (features) => {
  let rets = {};
  features.forEach((feat) => {
    rets[feat.getId() + ""] = feat;
  });
  var keys = Object.keys(rets);
  var ret = [];
  keys.forEach((key) => {
    ret.push(rets[key]);
  });
  return ret;
};
let _getFeaturesInView = (vtLayer2, map) => {
  return async () => {
    return getLoadingPromise(vtLayer2).then(async () => {
      let features = vtLayer2.getFeaturesInExtent(map.getView().calculateExtent());
      let ret = _deduplicateFeatures(features);
      return ret;
    });
  };
};
let getLoadingPromise = (vtLayer2) => {
  let resolve_;
  let promise = new Promise((resolve, reject) => {
    resolve_ = resolve;
  });
  if (!vtLayer2.loadPromiseResolves)
    vtLayer2.loadPromiseResolves = [];
  vtLayer2.loadPromiseResolves.push(resolve_);
  setTimeout(() => {
    if (!isLoadingTiles(vtLayer2.getSource())) {
      resolve_("Not Loading");
    }
  }, 150);
  return promise;
};
let _getFeaturesUnderPixel = (vtLayer2, map) => {
  return async (pixel, event) => {
    if (!pixel || !Array.isArray(pixel) || pixel.length != 2) {
      console.warn("Invalid parameter provided to getFeaturesUnderPixel. Expected an array with a length of 2. Got", pixel);
    }
    getLogger()("Getting features at", pixel);
    return getLoadingPromise(vtLayer2).then(async () => {
      getLogger()("Loaded tiles, calling getFeatures");
      let coords = map.getCoordinateFromPixel(pixel);
      getLogger()("Coords", coords);
      let zoom = map.getView().getZoom();
      getLogger()("Zoom", zoom);
      let buf = 25 - zoom;
      switch (zoom) {
        case 1:
        case 2:
        case 3:
        case 4:
        case 5:
        case 6:
          buf = 100;
          break;
        case 7:
        case 8:
        case 9:
        case 10:
          buf = 50;
          break;
        case 11:
        case 12:
        case 13:
        case 14:
        case 15:
          buf = 20;
          break;
        case 16:
        case 17:
        case 18:
        case 19:
        case 20:
        case 21:
        case 22:
        case 23:
        case 24:
          buf = 10;
          break;
        default:
          buf = 1;
          break;
      }
      if (buf <= 0) buf = 1;
      getLogger()("buf", buf);
      let ext = [coords[0] - buf, coords[1] - buf, coords[0] + buf, coords[1] + buf];
      getLogger()("ext", ext);
      let features = vtLayer2.getSource().getFeaturesInExtent(ext);
      getLogger()("Got features", features);
      let ret = _deduplicateFeatures(features);
      getLogger()("Deduplicated", ret);
      return ret;
    });
  };
};
let isLoadingTiles = (source2) => {
  let numLoading = Object.values(source2.sourceTiles_).filter((tile) => {
    return tile.status__ == "loading";
  }).length;
  getLogger()("Loading", numLoading);
  return numLoading > 0;
};
let handlePostRender = (source2, vtLayer2) => {
  vtLayer2.loadPromise = new Promise((resolve, reject) => {
    vtLayer2.loadPromiseResolve = resolve;
    vtLayer2.loadPromiseReject = reject;
  });
  return (evt) => {
    let loadingTiles = source2?.sourceTileCache ? source2.sourceTileCache.getValues().filter((tile) => {
      return tile.status__ == "loading";
    }) : [];
    let loadingTilesCount = loadingTiles.length;
    if (loadingTilesCount > 0) ; else {
      if (vtLayer2.loadPromiseResolves) {
        vtLayer2.loadPromiseResolves.forEach((resolve) => {
          resolve("Looded");
        });
        vtLayer2.loadPromiseResolves = null;
      }
    }
  };
};
const generate = (data, core2) => {
  var layers = data.config.value.endpoints.map((endpoint2) => {
    var url = endpoint2.url;
    var source2 = new VectorTileSource({
      maxZoom: 15,
      format: new MVT({
        idProperty: "id"
      }),
      tileSize: endpoint2.tileSize === void 0 ? 256 : endpoint2.tileSize,
      url
    });
    if (endpoint2.headers) {
      var loader = _loader(endpoint2);
      source2.setTileLoadFunction(loader);
    }
    console.log(data);
    var vtLayer2 = new VectorTileLayer({
      declutter: data.config.value.declutter === true,
      source: source2,
      zIndex: endpoint2.zIndex || 1e3
    });
    let moo = new ConfigurableStyle(endpoint2, source2, vtLayer2);
    vtLayer2.moo = moo;
    vtLayer2.style = moo.getStyle;
    vtLayer2.setStyle(moo.getStyle);
    vtLayer2.set("id", data.key);
    vtLayer2.refreshFunction = _refreshFunction(source2);
    vtLayer2.highlight = _highlight(source2);
    vtLayer2.unhighlight = _unhighlight(source2);
    vtLayer2.unhighlightAll = _unhighlightAll(source2);
    vtLayer2.applyFilters = _applyFilters(source2, vtLayer2);
    vtLayer2.filter = _buildEngine(source2);
    vtLayer2.clearFilters = _clearFilters();
    vtLayer2.filterEngine = _filterEngine();
    vtLayer2.getFeaturesInView = _getFeaturesInView(vtLayer2, core2.getMap());
    vtLayer2.getFeaturesUnderPixel = _getFeaturesUnderPixel(vtLayer2, core2.getMap());
    vtLayer2.on("postrender", handlePostRender(source2, vtLayer2));
    source2.on("tileloadend", handlePostRender(source2, vtLayer2));
    source2.on("tileloaderror", handlePostRender(source2, vtLayer2));
    if (data.config.value.cluster && data.config.value.cluster.enabled) {
      console.log("Clistering enabled");
      const clusterSource = new Cluster({
        distance: data.config.value.cluster.distance,
        minDistanc: data.config.value.cluster.minDistance,
        source: source2
      });
      const clusters = new VectorLayer({
        source: clusterSource,
        style: function(feature) {
          const size = feature.get("features").length;
          let style = styleCache[size];
          if (!style) {
            style = new Style({
              image: new CircleStyle({
                radius: 10,
                stroke: new Stroke({
                  color: "#fff"
                }),
                fill: new Fill({
                  color: "#3399CC"
                })
              }),
              text: new Text({
                text: size.toString(),
                fill: new Fill({
                  color: "#fff"
                })
              })
            });
            styleCache[size] = style;
          }
          return style;
        }
      });
      let group = new Group({ layers: [vtLayer2, clusters] });
      let oldVis = group.setVisible;
      let oldOpac = group.setOpacity;
      group.setVisible = function(vis) {
        console.log("Setting visibility of group", vis, this);
        oldVis.call(group, vis);
        this.getLayers().getArray().forEach((layer) => {
          layer.setVisible(vis);
        });
      };
      group.setOpacity = function(opac) {
        console.log("Setting opacity on group", opac, this);
        oldOpac.call(group, opac);
        this.getLayers().getArray().forEach((layer) => {
          layer.setOpacity(opac);
        });
      };
      vtLayer2 = group;
    }
    return vtLayer2;
  });
  return layers;
};
class MvtEndpointConfigBuilder {
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
    if (!this._endpoint.url || typeof this._endpoint.url !== "string") {
      throw new Error('Endpoint "url" is required and must be a string.');
    }
    if (this._endpoint.zIndex && typeof this._endpoint.zIndex !== "number") {
      throw new Error('Endpoint "zIndex" must be a number if provided.');
    }
    if (this._endpoint.tileSize && typeof this._endpoint.tileSize !== "number") {
      throw new Error('Endpoint "tileSize" must be a number if provided.');
    }
    if (this._endpoint.headers && typeof this._endpoint.headers !== "object") {
      throw new Error('Endpoint "headers" must be an object if provided.');
    }
    return { ...this._endpoint };
  }
}
class MvtConfigBuilder {
  /**
   * @param {Object} [initialConfig] - Optional initial configuration object.
   */
  constructor(initialConfig = {}) {
    this._config = {
      config: {
        value: {
          endpoints: [],
          ...initialConfig.config && initialConfig.config.value ? initialConfig.config.value : {}
        }
      },
      key: initialConfig.key || ""
    };
    if (initialConfig.config && initialConfig.config.value && Array.isArray(initialConfig.config.value.endpoints)) {
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
  addEndpoint(endpoint2) {
    if (!endpoint2 || typeof endpoint2 !== "object") {
      throw new Error("Endpoint must be an object.");
    }
    this._config.config.value.endpoints.push(endpoint2);
    return this;
  }
  build() {
    return this._config;
  }
}

export { MvtConfigBuilder, MvtEndpointConfigBuilder, generate };
//# sourceMappingURL=mvt.js.map
