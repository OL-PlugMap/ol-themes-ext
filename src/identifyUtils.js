
import { getLogger } from './logger'

// This function takes a feature and a dataMappingSettings
// This will iterate through the dataMappingSettings and
// apply the mapping settings to the feature
// For each setting it will apply the value to the feature
// in one of the following ways:
//
// 1. Copy the value from the "from" to the "to" in the properties
// 2. Move the value from the "from" to the "to" in the properties, this will delete the "from" after
// 3. Delete the value from the "from" in the properties
// 4. Replace the value from the "from" in the properties with the value in the "replace"
const featureMassage = (feature, dataMappingSettings) => {
    // This is a sample config for a mapping settings entry
    // {
    //     "from": "name",
    //     "to": "name",
    //     "mode": "copy"
    // }
    for (let mappingSetting of dataMappingSettings) {
        if (mappingSetting.from && feature.properties[mappingSetting.from]) {
            if (mappingSetting.mode === "copy") {
                feature.properties[mappingSetting.to] = feature.properties[mappingSetting.from];
            }
            else if (mappingSetting.mode === "move") {
                feature.properties[mappingSetting.to] = feature.properties[mappingSetting.from];
                delete feature.properties[mappingSetting.from];
            }
            else if (mappingSetting.mode === "delete") {
                delete feature.properties[mappingSetting.from];
            }
            else if (mappingSetting.mode === "replace") {
                feature.properties[mappingSetting.to] = mappingSetting.replace;
            }
            else {
                getLogger().error("Unknown mapping mode", mappingSetting.mode);
            }
        }
    }
}

// TODO: Write this to be less hacky.
export const getFeaturesInView = (layer, endpoint, map) => {

    if (endpoint.hasOwnProperty("zoom") && endpoint.zoom.hasOwnProperty("min")) {
        if (map.getView().getZoom() < endpoint.zoom.min) {
            return null;
        }
    }

    if (endpoint.hasOwnProperty("zoom") && endpoint.zoom.hasOwnProperty("max")) {
        if (map.getView().getZoom() > endpoint.zoom.max) {
            return null;
        }
    }
    if (!endpoint.identify) {
        return null
    }

    return async () => {

        let ident = endpoint.identify;
        if (ident.wfs) {

            // Get the extent in which we are looking
            let extent = map.getView().calculateExtent();
            let projectionEPSG = map.getView().getProjection().getCode();
            let wfsServiceUrl = ident.wfs.url;
            let featureType = endpoint.layerToShow;

            // Query the WFS to get the features that are in the extent
            let queryUrl = wfsServiceUrl + "?service=WFS&version=1.1.0&request=GetFeature&outputFormat=application/json&srsname=" + projectionEPSG + "&bbox=" + extent[0] + "," + extent[1] + "," + extent[2] + "," + extent[3] + "," + projectionEPSG + "&maxFeatures=1000" + "&typeName=" + featureType;

            getLogger()("Querying WFS", queryUrl);
            let response = await fetch(queryUrl);

            let features = await response.json();
            getLogger()("Got features", features);


            // Check the endpoint for the data mapping settings
            // If there are any, apply them to the features
            if (endpoint.identify.dataMappingSettings) {
                // If the response is a featureCollection, iterate through the features within the collection to apply the data mapping settings
                if (features.type === "FeatureCollection") {
                    for (let feature of features.features) {
                        featureMassage(feature, endpoint.identify.dataMappingSettings);
                    }
                } else { // If the response is a feature, apply the data mapping settings to the feature
                    featureMassage(features, endpoint.identify.dataMappingSettings);
                }
            }

            return features;

        } else if (ident.wms) {
            let extent = map.getView().calculateExtent();
            let projectionEPSG = map.getView().getProjection().getCode();
            let wmsServiceUrl = ident.wms.url;
            let layerToShow = endpoint.layerToShow;

            // Query the WMS to get the features that are in the extent
            let queryUrl = wmsServiceUrl + "?service=WMS&version=1.1.0&request=GetFeatureInfo&outputFormat=application/json&srsname=" + projectionEPSG + "&bbox=" + extent[0] + "," + extent[1] + "," + extent[2] + "," + extent[3] + "," + projectionEPSG + "&maxFeatures=1000" + "&width=512&height=512&info_format=application/json&x=0&y=0&query_layers=" + layerToShow;
            getLogger()("Querying WMS", queryUrl);
            let response = await fetch(queryUrl);

            let features = await response.json();
            getLogger()("Got features", features);

            // Check the endpoint for the data mapping settings
            // If there are any, apply them to the features
            if (endpoint.identify.dataMappingSettings) {
                // If the response is a featureCollection, iterate through the features within the collection to apply the data mapping settings
                if (features.type === "FeatureCollection") {
                    for (let feature of features.features) {
                        featureMassage(feature, endpoint.identify.dataMappingSettings);
                    }
                } else { // If the response is a feature, apply the data mapping settings to the feature
                    featureMassage(features, endpoint.identify.dataMappingSettings);
                }
            }

            return features;
        }


    }
}

export const getFeaturesUnderPixel = (layer, endpoint, map) => {
    return async (pixel, event) => {
        if (!pixel || !Array.isArray(pixel) || pixel.length != 2) {
            console.warn("Invalid parameter provided to getFeaturesUnderPixel. Expected an array with a length of 2. Got", pixel);
        }

        // Convert the pixel to a coordinate
        let coords = map.getCoordinateFromPixel(pixel);
        if (endpoint.identify) {
            let ident = endpoint.identify;
            if (ident.wfs) {
                let wfsServiceUrl = ident.wfs.url;
                let featureType = endpoint.layerToShow || ident.wfs.layer;

                // Query the WFS to get the features that are in the extent
                let queryUrl = wfsServiceUrl + "?service=WFS&version=1.1.0&request=GetFeature&outputFormat=application/json&srsname=EPSG:3857&bbox=" + (coords[0] - 0.25) + "," + (coords[1] - 0.25) + "," + (coords[0] + 0.25) + "," + (coords[1] + 0.25) + ",EPSG:3857" + "&maxFeatures=1000";
                if (featureType)
                    queryUrl += "&typeName=" + featureType;
                getLogger()("Querying WFS", queryUrl);
                let response = await fetch(queryUrl);

                let features = await response.json();
                getLogger()("Got features", features);


                // Check the endpoint for the data mapping settings
                // If there are any, apply them to the features
                if (endpoint.identify.dataMappingSettings) {
                    // If the response is a featureCollection, iterate through the features within the collection to apply the data mapping settings
                    if (features.type === "FeatureCollection") {
                        for (let feature of features.features) {
                            featureMassage(feature, endpoint.identify.dataMappingSettings);
                        }
                    } else { // If the response is a feature, apply the data mapping settings to the feature
                        featureMassage(features, endpoint.identify.dataMappingSettings);
                    }
                }

                return features;
            } else if (ident.wms) {
                let wmsServiceUrl = ident.wms.url;
                let layerToShow = endpoint.layerToShow;

                // Query the WMS to get the features that are in the extent
                let queryUrl = wmsServiceUrl + "?service=WMS&version=1.1.0&request=GetFeatureInfo&outputFormat=application/json&srsname=EPSG:3857&bbox=" + coords[0] + "," + coords[1] + "," + coords[0] + "," + coords[1] + ",EPSG:3857" + "&maxFeatures=1000" + "&width=512&height=512&info_format=application/json&x=0&y=0&query_layers=" + layerToShow;
                getLogger()("Querying WMS", queryUrl);
                let response = await fetch(queryUrl);

                let features = await response.json();
                getLogger()("Got features", features);


                // Check the endpoint for the data mapping settings
                // If there are any, apply them to the features
                if (endpoint.identify.dataMappingSettings) {
                    // If the response is a featureCollection, iterate through the features within the collection to apply the data mapping settings
                    if (features.type === "FeatureCollection") {
                        for (let feature of features.features) {
                            featureMassage(feature, endpoint.identify.dataMappingSettings);
                        }
                    } else { // If the response is a feature, apply the data mapping settings to the feature
                        featureMassage(features, endpoint.identify.dataMappingSettings);
                    }
                }

                return features;
            }
        }

    }
}