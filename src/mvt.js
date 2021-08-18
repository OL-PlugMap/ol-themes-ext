import VectorTileLayer from 'ol/layer/VectorTile';
import VectorTileSource from 'ol/source/VectorTile';
import MVT from 'ol/format/MVT';

import { _styleFunction } from './vectorStyles'
import { getLogger } from './logger';




let _filterEngine = (source) => {
  (feature) => {
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
      this.changed();
    }
    else {
      if (!source.inview)
        vtLayer.setVisible(false);
      this.changed();
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
  let featureId = -1;
    if(isNaN(feature))
    {
      if(feature.properties_)
      {
        featureId = feature.get("iso_a3"); //TODO
      }
      else
      {
        getLogger()("Halp");
      }
    }
    else
    {
      featureId = feature;
    }
  return featureId;
}

let _unhighlight = (source) => {
  return (feature) => {
    delete source.highlightFeats[getId(feature)];
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

let _loader = (endpoint) => {
  return function(tile, url) {
    tile.setLoader(function(extent, resolution, projection) {
      var fetchModel =
        {
          method: 'GET',
          mode: 'cors',
          cache: 'no-cache',
          headers: endpoint.headers
        };
      tile.status__ = "loading";
      fetch(url, fetchModel).then(function(response) {
        tile.status__ = "loaded";
        response.arrayBuffer().then(function(data) {
          const format = tile.getFormat()
          const features = format.readFeatures(data, {
            extent: extent,
            featureProjection: projection
          });
          tile.setFeatures(features);
        });
      })
      .catch(err => {
        tile.status__ = "error";
      });
    });
  }
};


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
      let features = vtLayer.getSource().getFeaturesInExtent(map.getView().calculateExtent());
      
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
  }, 500);


  return promise;
}

let _getFeaturesUnderPixel = (vtLayer) => {
  return async (pixel) => {
    return getLoadingPromise(vtLayer).then(async () => {
      let features = await vtLayer.getFeatures(pixel);
      
      let ret = _deduplicateFeatures(features);

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
  let numLoading = source.sourceTileCache.getValues().filter(tile => { return tile.status__ == "loading" }).length;
  getLogger()("Loading", numLoading);
  return numLoading > 0;
}

let handlePostRender = (source, vtLayer) => {
  
  vtLayer.loadPromise = new Promise((resolve,reject) => {
    vtLayer.loadPromiseResolve = resolve;
    vtLayer.loadPromiseReject = reject;
  });

  return (evt) => {
    let loadingTiles = source.sourceTileCache.getValues().filter(tile => { return tile.status__ == "loading" });
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
          url: url
        });

        if(endpoint.headers)
        {
          var loader = _loader(endpoint);

          source.setTileLoadFunction(loader);
        }

        let configureSource = _configureSource;

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

        vtLayer.style = _styleFunction(endpoint, source, vtLayer);
        vtLayer.setStyle(_styleFunction(endpoint, source, vtLayer))

        vtLayer.set('id', data.key);
        
        vtLayer.refreshFunction = _refreshFunction(source);

        vtLayer.highlight = _highlight(source);

        vtLayer.unhighlight = _unhighlight(source);

        vtLayer.applyFilters = _applyFilters(source, vtLayer);
          
        vtLayer.clearFilters = _clearFilters(source);

        vtLayer.filterEngine = _filterEngine(source);

        vtLayer.getFeaturesInView = _getFeaturesInView(vtLayer, core.getMap())

        vtLayer.getFeaturesUnderPixel = _getFeaturesUnderPixel(vtLayer);
      
        vtLayer.on('postrender', handlePostRender(source, vtLayer));
        source.on('tileloadend', handlePostRender(source, vtLayer));
        source.on('tileloaderror', handlePostRender(source, vtLayer));

        return vtLayer;
      });

    return layers;
}