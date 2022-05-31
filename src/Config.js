export function isConfig(config) {
    return config && config.layers && config.layerGroups && config.layerCategories;
}

export function convertLayer(oldValue) {

    let newValue = { ...oldValue };

    newValue.key = ""
    newValue.name = "",
    newValue.opacity = 1;
    newValue.config = {};
    

    let targetKey = undefined;

    if(oldValue.xyz) {
        targetKey = "xyz";
        delete newValue.xyz;
    }

    if(oldValue.esriFeature) {
        targetKey = "esriFeature";
        delete newValue.esriFeature;
    }

    if(oldValue.esriExport) {
        targetKey = "esriExport";
        delete newValue.esriExport;
    }

    if(oldValue.mvt) {
        targetKey = "mvt";
        delete newValue.mvt;
    }
        
    if(oldValue.staticVector) {
        targetKey = "staticVector";
        delete newValue.staticVector;
    }

    if(oldValue.wms) {
        targetKey = "wms";
        delete newValue.wms;
    }

    if(oldValue.wfs) {
        targetKey = "wfs";
        delete newValue.wfs;
    }

    if(oldValue.wmts) {
        targetKey = "wmts";
        delete newValue.wmts;
    }
    
    if(!targetKey)
    {
        debugger;
        console.error("Encountered an unknown config for layer", oldValue);
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
            clusterSettings.enabled = true;
            clusterSettings.distance = oldValue[targetKey].cluster.distance;
            clusterSettings.minDistance = oldValue[targetKey].cluster.minDistance;

            newValue.config.value.cluster = clusterSettings;
        }
    }
    else if (targetKey === "wms" || targetKey === "wmts")
    {
        newValue.config.value.extent = oldValue[targetKey].extent;
        newValue.config.value.endpoints = newValue.config.value.endpoints.map(endpoint => {
            if(endpoint.layers !== undefined) {
                let layers = endpoint.layers;
                if(!Array.isArray(layers))
                    layers = [layers];

                return { ...endpoint, layers };
            }
            return endpoint;
        }); 
    }


    return newValue;
}

const processCrossfade = (crossfade) => {
    if(!crossfade)
        return undefined;
        
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
            else {
                debugger;
                console.error("Failed to convert layer! Not adding to map")
            }
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
                    console.warn("Could not find a mapped layer with key", layerKey)
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
                    selection_type: category.selectiveness || 'polyselective',
                    selection_keys: category.defaultSelection || []
                },
                opacity: !isNaN(category.opacity) ? category.opacity : !isNaN(category.transparency) ? category.transparency : 1,
                crossfade: processCrossfade(category.crossfade)
            }

            if(!category.layerGroups)
            {
                if(category.groups)
                {
                    category.layerGroups = category.groups;
                }
                else
                {
                    debugger;
                    console.warn("Provided layer groups is not valid. Defaulting to an empty list.", category);
                    category.layerGroups = [];
                }
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