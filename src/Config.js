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
        
    if(oldValue.staticVector)
        targetKey = "staticVector";

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
        minZoom: oldValue[targetKey].minZoom
    }

    if(targetKey === "mvt")
    {
        newValue.config.value.declutter = oldValue[targetKey].declutter;
        let clusterSettings = {};
        
        if(oldValue[targetKey].cluster)
        {
            console.log("Found cluster settings", oldValue[targetKey].cluster);
            clusterSettings.enabled = true;
            clusterSettings.distance = oldValue[targetKey].cluster.distance;
            clusterSettings.minDistance = oldValue[targetKey].cluster.minDistance;

            newValue.config.value.cluster = clusterSettings;
        }
    }
    else if (targetKey === "wms" || targetKey === "wmts")
    {
        newValue.config.value.extent = oldValue[targetKey].extent;
    }


    return newValue;
}

const processCrossfade = (crossfade) => {
    if(!crossfade)
        return undefined;
    console.log("Processing crossfade", crossfade);
    return {
        from: crossfade.from,
        to: crossfade.to,
        duration: crossfade.duration,
        startZoom: crossfade.startZoom,
        endZoom: crossfade.endZoom,
    }
}

export function convertConfig(config) {
    if(isConfig(config))
    {
        let convertedCategories = [];
        let groupMap = {};
        let layerMap = {};

        for(var layer of config.layers)
        {
            layer = convertLayer(layer);
            
            if(layer)
            {
                layerMap[layer.key] = layer;
            }
            else
                console.log("Failed to convert layer! Not adding to map")
        }

        for(var group of config.layerGroups)
        {
            let newGroup =
                { 
                    group_key : group.key,
                    name: group.name,
                    openness: group.openness,
                    layers: []
                }

            if(!group.layers)
            {
                //Bad hack but prevents crashing when no layers are in a group or the key is missing
                console.warn("Provided layers in groups is not valid. Defaulting to an empty list.", group);
                group.layers = [];
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

        let categories = [];

        for(var category of config.layerCategories)
        {
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
                },
                opacity: !isNaN(category.opacity) ? category.opacity : !isNaN(category.transparency) ? category.transparency : 1,
                crossfade: processCrossfade(category.crossfade)
            }

            if(!category.layerGroups)
            {
                console.warn("Provided layer groups is not valid. Defaulting to an empty list.", category);
                category.layerGroups = [];
            }

            for(let grpKey of category.layerGroups)
            {
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