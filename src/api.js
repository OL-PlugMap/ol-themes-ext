import Core from "./Core"
import Themes from "./map-layer-helper";

import { isConfig, convertConfig } from "./Config"

export default class ol_themes_ext {
    constructor(map) {

        this.map = map;
        
        console.log("Creating core");
        this.core = new Core(map);

        console.log("Core init");
        this.core.init({},{ ports: {} });


        console.log("Setting some stuff up to map")
        
        map.themes = this;
        
        return map;
    }

    initThemes() {
        if(!this.themes)
        {
            console.log("Initializing themes plugin");

            this.themes = new Themes();
            this.themes.apply(this.core);
        }
    }


    initLayers(layers) {
        console.log("Init layers", layers)

        this.initThemes()

        var olLayers = this.themes.addLayers(layers)

        return olLayers;
    }

    initGroups(groups) {
        console.log("Init Groups", groups)

        this.initThemes()

        var olLayers = this.themes.addGroups(layers)

        return olLayers;
    }

    

    initCategories(categories) {
        console.log("Init Categories Top");

        if(isConfig(categories))
        {
            console.log("Got a config ... converting to categories ...")
            categories = convertConfig(categories);
        }

        console.log("Init Categories", categories)

        this.initThemes()

        var olCategories = this.themes.addLayerCategories(categories);

        return olCategories;
    }

    
}