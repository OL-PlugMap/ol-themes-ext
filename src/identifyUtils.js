
import { getLogger } from './logger'

// TODO: Write this to be less hacky.
export const getFeaturesInView = (layer, endpoint, map) => {
    return async () => {
        if(endpoint.identify) {
            let ident = endpoint.identify;
            if(ident.wfs) {
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
                return features;
            }
        }
        
    }
}

export const getFeaturesUnderPixel = (layer, endpoint, map) => {
    return async (pixel, event) => {
        if(!pixel || !Array.isArray(pixel) || pixel.length != 2)
        {
          console.warn("Invalid parameter provided to getFeaturesUnderPixel. Expected an array with a length of 2. Got", pixel);
        }
        
        // Convert the pixel to a coordinate
        let coords = map.getCoordinateFromPixel(pixel);
        if(endpoint.identify) {
            let ident = endpoint.identify;
            if(ident.wfs) {
                let wfsServiceUrl = ident.wfs.url;
                let featureType = endpoint.layerToShow || ident.wfs.layer;

                // Query the WFS to get the features that are in the extent
                let queryUrl = wfsServiceUrl + "?service=WFS&version=1.1.0&request=GetFeature&outputFormat=application/json&srsname=EPSG:3857&bbox=" + (coords[0]-0.25) + "," + (coords[1]-0.25) + "," + (coords[0]+0.25) + "," + (coords[1]+0.25) + ",EPSG:3857" + "&maxFeatures=1000";
                if(featureType)
                    queryUrl += "&typeName=" + featureType;
                getLogger()("Querying WFS", queryUrl);
                let response = await fetch(queryUrl);
                let features = await response.json();
                getLogger()("Got features", features);
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
                return features;
            }
        }
        
    }
}