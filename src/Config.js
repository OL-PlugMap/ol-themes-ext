export function isConfig(config) {
    return config && config.layers && config.layerGroups && config.layerCategories;
}

export function convertLayer(oldValue) {

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

export function convertConfig(config) {
    console.log("Converting config", config);

    if(isConfig(config))
    {
        let convertedCategories = [];
        let groupMap = {};
        let layerMap = {};

        console.log("Converting layers")
        for(var layer of config.layers)
        {
            console.log("Taking a peep at", layer.key)
            layer = convertLayer(layer);
            
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