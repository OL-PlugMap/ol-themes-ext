import Core from "./Core"
import Themes from "./map-layer-helper";

import { isConfig, convertConfig } from "./Config"
import { getLogger } from "./logger";

export default class ol_themes_ext {
    constructor(map) {

        this.map = map;
        
        this.core = new Core(map);

        this.core.init({},{ ports: {} });

        map.themes = this;

        this.crossfadeHooks = [];
        this.crossfadespeed = 50; // 1/20th of a second
        
        return map;
    }

    initThemes() {
        if(!this.themes)
        {
            this.themes = new Themes();
            this.themes.apply(this.core);
        }
    }


    initLayers(layers) {
        this.initThemes()

        var olLayers = this.themes.addLayers(layers)

        return olLayers;
    }

    initGroups(groups) {
        this.initThemes()

        var olLayers = this.themes.addGroups(layers)

        return olLayers;
    }

    initMapHooks() {
        this.map.on('moveend', this.processExtentChanged.bind(this));        
    }

    processExtentChanged(evt) {
        getLogger("ol-themes-ext Extent changed", evt);

        let newZoom = this.map.getView().getZoom();
        
        if(this.oldZoom != newZoom)
        {
            if(this.crossfadeHooks.length > 0)
                this.crossfade();
        }
    }

    crossfade() {
        getLogger("Crossfade");

        // If theres another crossfade running, stop it
        if(this.crossfadeTimeoutId) {
            clearTimeout(this.crossfadeTimeoutId);
            this.crossfadeTimeoutId = null;
        }

        let anyCrossfadeStepped = false;

        // Step all crossfade hooks
        this.crossfadeHooks.forEach(category => {
            anyCrossfadeStepped = this.crossfadeStep(category, this.crossfadespeed) || anyCrossfadeStepped;
        });

        // If any crossfade steps were taken, then we need to schedule another step otherwise we're done
        if(anyCrossfadeStepped)
        {
            this.crossfadeTimeoutId = setTimeout(this.crossfade.bind(this), this.crossfadespeed);
        }
    }


    getTargetOpacityForCrossfade(category)
    {
        let crossfadeConfig = category.crossfade;
        let curZoom = this.map.getView().getZoom();

        let targetOpacity = ((curZoom - crossfadeConfig.startZoom) / (crossfadeConfig.endZoom - crossfadeConfig.startZoom));

        if(targetOpacity < 0)
            targetOpacity = 0;
        else if(targetOpacity > 1)
            targetOpacity = 1;
        
        return targetOpacity;
    }

    crossfadeStep(category, deltaTime) {
        getLogger("Crossfade step", category, deltaTime);

        let crossfadeConfig = category.crossfade;
        let targetOpacity = this.getTargetOpacityForCrossfade(category);
        let opacityPerStep = 1/(crossfadeConfig.endZoom - crossfadeConfig.startZoom)
        let curentOpacity = this.getCategoryByKey(category.category_key).getLayerByKey(crossfadeConfig.to).getOpacity();

        getLogger("Target opacity", targetOpacity, "Current opacity", curentOpacity, "Opacity per step", opacityPerStep);
        
        if(targetOpacity == curentOpacity)
            return false;

        let delta = (targetOpacity - curentOpacity);

        let stepOpacity = curentOpacity;

        if(Math.abs(delta) < 0.01)
        {
            stepOpacity = targetOpacity;
        }
        else
        {
            stepOpacity += ( deltaTime / ( crossfadeConfig.duration * 1000 ) ) * (delta < 0 ? -1 : 1) * opacityPerStep;
        }

        if(stepOpacity < 0)
            stepOpacity = 0;
        else if(stepOpacity > 1)
            stepOpacity = 1;


            getLogger("Step opacity", stepOpacity);

        this.getCategoryByKey(category.category_key).getLayerByKey(crossfadeConfig.to).setOpacity(stepOpacity);
        this.getCategoryByKey(category.category_key).getLayerByKey(crossfadeConfig.to).setVisible(stepOpacity > 0);

        this.getCategoryByKey(category.category_key).getLayerByKey(crossfadeConfig.from).setOpacity(1-stepOpacity);
        this.getCategoryByKey(category.category_key).getLayerByKey(crossfadeConfig.from).setVisible(stepOpacity < 1);
        
        return true;
    }
    

    initCategories(config, withConfig) {
        if(isConfig(config))
        {
            config = convertConfig(config);
        }

        getLogger("Setting up", config);

        this.initThemes()

        var olCategories = this.themes.addLayerCategories(config);

        this.categories = olCategories;

        config.forEach(category => {
            if(category.crossfade) {
                this.crossfadeHooks.push(category);
            }
        });

        getLogger("Crossfade hooks", this.crossfadeHooks);

        if(this.crossfadeHooks.length > 0)
        {
            this.initMapHooks();
        }

        if(!withConfig)
            return olCategories;
        else
            return { categories: olCategories, config: config };
    }

    getCategoryByKey(key) {
        let matching = this.categories.filter(cat => {
            return cat.metadata.key === key;
        });

        if(matching)
            return matching[0];
    }

    getCategories() {
        return this.categories;
    }

    
}

export function extendWithThemes(map) {
    return new ol_themes_ext(map);
}