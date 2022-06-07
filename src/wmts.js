import { get } from "ol/proj";
import { getTopLeft, getWidth } from "ol/extent";
import { getLogger } from './logger'
import { getSldLegend } from './sharedOGC'
import WMTS from "ol/source/WMTS";
import WMTSTileGrid from "ol/tilegrid/WMTS";
import { Tile as TileLayer } from "ol/layer.js";


const _getFeaturesInView = (layer, endpoint, map) => {
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

const _getFeaturesUnderPixel = (layer, endpoint, map) => {
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


export const generate = (layerConfig, core) => {
    var projection = get("EPSG:3857"),
        projectionExtent = projection.getExtent(),
        size = getWidth(projectionExtent) / 256,
        zooms = 15 + 1,
        resolutions = new Array(zooms),
        matrixIds = new Array(zooms);
    for (let z = 0; z < zooms; ++z) {
        resolutions[z] = size / Math.pow(2, z);
        matrixIds[z] = "EPSG%3A3857%3A"+z;
    }

    let layers = layerConfig.config.value.endpoints.map(endpoint => {

        let errors = [];
        if (!endpoint.url || endpoint.url.indexOf("?") == -1) {
            endpoint.url += "?Service=WMTS&Request=GetTile&Version=1.0.0&Format=image/png";
        }
        if (!endpoint.url || endpoint.url.indexOf("{TileMatrixSet}") == -1) {
            endpoint.url += "&TileMatrixSet={TileMatrixSet}"
            //errors.push("Missing \"{TileMatrixSet}\" in WMTS endpoint");
        }
        if (!endpoint.url || endpoint.url.indexOf("{TileMatrix}") == -1) {
            endpoint.url += "&TileMatrix={TileMatrix}"
            //errors.push("Missing \"{TileMatrix}\" in WMTS endpoint");
        }
        if (!endpoint.url || endpoint.url.indexOf("{TileRow}") == -1) {
            endpoint.url += "&TileRow={TileRow}"
            //errors.push("Missing \"{TileRow}\" in WMTS endpoint");
        }
        if (!endpoint.url || endpoint.url.indexOf("{TileCol}") == -1) {
            endpoint.url += "&TileCol={TileCol}"
            //errors.push("Missing \"{TileCol}\" in WMTS endpoint");
        }
        if (!endpoint.url || endpoint.url.indexOf("Layer") == -1) {
            endpoint.url += "&Layer={Layer}"
            //errors.push("Missing \"{Layer}\" in WMTS endpoint");
        }
        if (errors.length > 0) {
            console.error("Errors in WMTS endpoint", errors);
        }

        //Replace the {Layer} parameter with the layerToShow in the endpoint url
        if (endpoint.layerToShow) {
            endpoint.url = endpoint.url.replace("{Layer}", endpoint.layerToShow);
        }

        let source = new WMTS({
            crossOrigin: 'anonymous',
            matrixSet: 'EPSG%3A3857',
            format: 'image/png',
            projection: projection,
            requestEncoding: 'REST',
            tileGrid: new WMTSTileGrid({
                extent: layerConfig.config.value.extent,
                resolutions: resolutions,
                matrixIds: matrixIds,
                origin: getTopLeft(projectionExtent)
            }),
            style: 'default',
            layer: endpoint.layerToShow,
            opaque: false,
            transparent: true,
            url: endpoint.url
        });
        let lyr = new TileLayer({
            visible: false,
            preload: 4,
            zIndex: endpoint.zIndex || 0,
            opacity: isNaN(layerConfig.opacity) || layerConfig.opacity == null ? 1 : layerConfig.opacity,
            source: source,
            opaque: false
        });
        lyr.set('id', layerConfig.key);
        lyr.set('name', layerConfig.name);


        lyr.getLegend = async function () {

            if (endpoint.legendEntries) {
                return endpoint.legendEntries;
            }

            if ((layerConfig.legend?.enabled && layerConfig.legend?.method === 'sld') || (endpoint.legend && endpoint.legend.method === 'sld')) {
                endpoint.legendEntries = await getSldLegend(endpoint);
            }


            return endpoint.legendEntries;
        }

        

        lyr.getFeaturesInView = _getFeaturesInView(lyr, endpoint, core.getMap())

        lyr.getFeaturesUnderPixel = _getFeaturesUnderPixel(lyr, endpoint, core.getMap());

        return lyr;
    });

    return layers;
}