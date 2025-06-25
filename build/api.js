import Core from './Core.js';
import Themes from './map-layer-helper.js';
import { isConfig, convertConfig } from './Config.js';
import { getLogger } from './logger.js';

class ol_themes_ext {
  constructor(map) {
    this.map = map;
    this.core = new Core(map);
    this.core.init({}, { ports: {} });
    map.themes = this;
    this.crossfadeHooks = [];
    this.crossfadespeed = 50;
    return map;
  }
  initThemes() {
    if (!this.themes) {
      this.themes = new Themes();
      this.themes.apply(this.core);
    }
  }
  initLayers(layers2) {
    this.initThemes();
    var olLayers = this.themes.addLayers(layers2);
    return olLayers;
  }
  initGroups(groups) {
    this.initThemes();
    var olLayers = this.themes.addGroups(layers);
    return olLayers;
  }
  initMapHooks() {
    this.map.on("moveend", this.processExtentChanged.bind(this));
  }
  processExtentChanged(evt) {
    let newZoom = this.map.getView().getZoom();
    if (this.oldZoom != newZoom) {
      if (this.crossfadeHooks.length > 0)
        this.crossfade();
    }
  }
  crossfade() {
    if (this.crossfadeTimeoutId) {
      clearTimeout(this.crossfadeTimeoutId);
      this.crossfadeTimeoutId = null;
    }
    let anyCrossfadeStepped = false;
    this.crossfadeHooks.forEach((category) => {
      anyCrossfadeStepped = this.crossfadeStep(category, this.crossfadespeed) || anyCrossfadeStepped;
    });
    if (anyCrossfadeStepped) {
      this.crossfadeTimeoutId = setTimeout(this.crossfade.bind(this), this.crossfadespeed);
    }
  }
  getTargetOpacityForCrossfade(category) {
    let crossfadeConfig = category.crossfade;
    let curZoom = this.map.getView().getZoom();
    let targetOpacity = (curZoom - crossfadeConfig.startZoom) / (crossfadeConfig.endZoom - crossfadeConfig.startZoom);
    if (targetOpacity < 0)
      targetOpacity = 0;
    else if (targetOpacity > 1)
      targetOpacity = 1;
    return targetOpacity;
  }
  crossfadeStep(category, deltaTime) {
    let crossfadeConfig = category.crossfade;
    let targetOpacity = this.getTargetOpacityForCrossfade(category);
    let opacityPerStep = 1 / (crossfadeConfig.endZoom - crossfadeConfig.startZoom);
    let curentOpacity = this.getCategoryByKey(category.category_key).getLayerByKey(crossfadeConfig.to).getOpacity();
    if (targetOpacity == curentOpacity)
      return false;
    let delta = targetOpacity - curentOpacity;
    let stepOpacity = curentOpacity;
    if (Math.abs(delta) < 0.01) {
      stepOpacity = targetOpacity;
    } else {
      stepOpacity += deltaTime / (crossfadeConfig.duration * 1e3) * (delta < 0 ? -1 : 1) * opacityPerStep;
    }
    if (stepOpacity < 0)
      stepOpacity = 0;
    else if (stepOpacity > 1)
      stepOpacity = 1;
    this.getCategoryByKey(category.category_key).getLayerByKey(crossfadeConfig.to).setOpacity(stepOpacity);
    this.getCategoryByKey(category.category_key).getLayerByKey(crossfadeConfig.to).setVisible(stepOpacity > 0);
    this.getCategoryByKey(category.category_key).getLayerByKey(crossfadeConfig.from).setOpacity(1 - stepOpacity);
    this.getCategoryByKey(category.category_key).getLayerByKey(crossfadeConfig.from).setVisible(stepOpacity < 1);
    return true;
  }
  initCategories(config, withConfig) {
    console.log("Init categories");
    getLogger()("Setting up", config);
    if (isConfig(config)) {
      config = convertConfig(config);
    }
    this.initThemes();
    var olCategories = this.themes.addLayerCategories(config);
    this.categories = olCategories;
    config.forEach((category) => {
      if (category.crossfade) {
        this.crossfadeHooks.push(category);
      }
    });
    getLogger("Crossfade hooks", this.crossfadeHooks);
    if (this.crossfadeHooks.length > 0) {
      this.initMapHooks();
    }
    if (!withConfig)
      return olCategories;
    else
      return { categories: olCategories, config };
  }
  getCategoryByKey(key) {
    let matching = this.categories.filter((cat) => {
      return cat.metadata.key === key;
    });
    if (matching)
      return matching[0];
  }
  getCategories() {
    return this.categories;
  }
  async getFeaturesInView() {
    let all = [];
    for (let category of this.categories) {
      if (category.getFeaturesInView) {
        let catF = category.getFeaturesInView();
        if (catF && catF.length > 0) {
          all = all.concat(catF);
        }
      }
    }
    let every = await Promise.all(all);
    return every.flat();
  }
}
function extendWithThemes(map) {
  return new ol_themes_ext(map);
}

export { ol_themes_ext as default, extendWithThemes };
//# sourceMappingURL=api.js.map
