import Core from "./Core"
import Themes from "./map-layer-helper";

export default class ol_themes_ext {
    constructor(map) {

        this.map = map;
        
        console.log("Creating core");
        this.core = new Core(map);

        console.log("Core init");
        this.core.init({},{ ports: {} });


        console.log("Setting some stuff up to map")

        map.core = this.core;


        map.initThemes = this.initThemes;

        map.isConfig = this.isConfig;
        map.convertLayer = this.convertLayer;
        map.initLayers = this.initLayers;
        map.initGroups = this.initGroups;
        map.initCategories = this.initCategories;
        map.convertConfig = this.convertConfig;
        
        
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

    isConfig(config) {
        return config && config.layers && config.layerGroups && config.layerCategories;
    }

    initCategories(categories) {
        console.log("Init Categories Top");

        if(this.isConfig(categories))
        {
            console.log("Got a config ... converting to categories ...")
            categories = this.convertConfig(categories);
        }

        console.log("Init Categories", categories)

        this.initThemes()

        var olCategories = this.themes.addLayerCategories(categories);

        return olCategories;
    }

    convertLayer(oldValue) {

        let newValue = {
            key: "",
            name: "",
            opacity: 1,
            config: {},
        }

        let targetKey = undefined;

        if(oldValue.xyz)
            targetKey = "xyz";

        if(oldValue.esriFeature)
            targetKey = "esriFeature";

        if(oldValue.esriExport)
            targetKey = "esriExport";

        if(oldValue.mvt)
            targetKey = "mvt";

        if(oldValue.wms)
            targetKey = "wms";

        if(oldValue.wmts)
            targetKey = "wmts";
        
        if(!targetKey)
        {
            console.log("Encountered an unknown config for layer", oldValue);
            return undefined;
        }

        newValue.key = oldValue.key;
        newValue.name = oldValue.name;
        newValue.opacity = oldValue.opacity;
        newValue.config.type = targetKey;
        newValue.config.value = {
            endpoints: oldValue[targetKey].endpoints,
            maxZoom: oldValue[targetKey].maxZoom,
            minZoom: oldValue[targetKey].minZoom,
        }

        return newValue;
    }

    convertConfig(config) {
        console.log("Converting config", config);

        if(this.isConfig(config))
        {
            let convertedCategories = [];
            let groupMap = {};
            let layerMap = {};

            console.log("Converting layers")
            for(var layer of config.layers)
            {
                console.log("Taking a peep at", layer.key)
                layer = this.convertLayer(layer);
                
                if(layer)
                {
                    layerMap[layer.key] = layer;
                }
                else
                    console.log("Failed to convert layer! Not adding to map")
            }

            console.log("Converting groups")
            for(var group of config.layerGroups)
            {
                let newGroup =
                    { 
                        group_key : group.key,
                        name: group.name,
                        openness: group.openness,
                        layers: []
                    }

                for(var layerKey of group.layers)
                {
                    if(layerMap[layerKey])
                        newGroup.layers.push(layerMap[layerKey]);
                    else
                        console.log("Could not find a mapped layer with key", layerKey)
                }

                groupMap[group.key] = newGroup;
            }

            console.log("Converting categories")

            let categories = [];

            for(var category of config.layerCategories)
            {
                console.log("Taking a peep at", category.key);
                let newCat = {
                    category_key: category.key,
                    name: category.name,
                    hidden: category.hidden,
                    openness: category.openness,
                    multiphasic: category.multiphasic,
                    selectiveness: category.selectiveness,
                    groups: [],
                    layers: [],
                    selection: {
                        selection_type: category.selectiveness,
                        selection_keys: category.defaultSelection
                    }
                }

                console.log("Translating Groups", category.layerGroups);
                for(let grpKey of category.layerGroups)
                {
                    console.log("Taking a peep at", grpKey);

                    if(groupMap[grpKey])
                    {
                        newCat.groups.push(groupMap[grpKey]);
                        for(let lyr of groupMap[grpKey].layers)
                            newCat.layers.push(lyr);
                    }
                }

                categories.push(newCat);
            }

            return categories;
        }

    }
}