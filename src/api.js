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

    

    initCategories(config, withConfig) {
        if(isConfig(config))
        {
            config = convertConfig(config);
        }

        getLogger("Setting up", config);

        this.initThemes()

        var olCategories = this.themes.addLayerCategories(config);

        this.categories = olCategories;

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