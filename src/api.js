import Core from "./Core"
import Themes from "./map-layer-helper";

import { isConfig, convertConfig } from "./Config"

export default class ol_themes_ext {
    constructor(map) {

        this.map = map;
        
        this.core = new Core(map);

        this.core.init({},{ ports: {} });


        map.themes = this;
        
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

    

    initCategories(categories) {
        if(isConfig(categories))
        {
            categories = convertConfig(categories);
        }

        this.initThemes()

        var olCategories = this.themes.addLayerCategories(categories);

        return olCategories;
    }

    
}

export function extendWithThemes(map) {
    return new ol_themes_ext(map);
}