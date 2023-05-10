import { get } from "ol/proj";
import { getTopLeft, getWidth } from "ol/extent";
import { getLogger } from './logger'
import { getSldLegend } from './sharedOGC'
import WMTS from "ol/source/WMTS";
import WMTSTileGrid from "ol/tilegrid/WMTS";
import { Tile as TileLayer } from "ol/layer.js";

import * as identifyUtils from './identifyUtils'


const _getFeaturesInView = (layer, endpoint, map) => {
    return identifyUtils.getFeaturesInView(layer, endpoint, map);
}

const _getFeaturesUnderPixel = (layer, endpoint, map) => {
    return identifyUtils.getFeaturesUnderPixel(layer, endpoint, map);
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
        // if (!endpoint.url || endpoint.url.indexOf("?") == -1) {
        //     endpoint.url += "?Service=WMTS&Request=GetTile&Version=1.0.0&Format=image/png";
        // }
        // if (!endpoint.url || endpoint.url.indexOf("{TileMatrixSet}") == -1) {
        //     endpoint.url += "&TileMatrixSet={TileMatrixSet}"
        //     //errors.push("Missing \"{TileMatrixSet}\" in WMTS endpoint");
        // }
        // if (!endpoint.url || endpoint.url.indexOf("{TileMatrix}") == -1) {
        //     endpoint.url += "&TileMatrix={TileMatrix}"
        //     //errors.push("Missing \"{TileMatrix}\" in WMTS endpoint");
        // }
        // if (!endpoint.url || endpoint.url.indexOf("{TileRow}") == -1) {
        //     endpoint.url += "&TileRow={TileRow}"
        //     //errors.push("Missing \"{TileRow}\" in WMTS endpoint");
        // }
        // if (!endpoint.url || endpoint.url.indexOf("{TileCol}") == -1) {
        //     endpoint.url += "&TileCol={TileCol}"
        //     //errors.push("Missing \"{TileCol}\" in WMTS endpoint");
        // }
        // if (!endpoint.url || endpoint.url.indexOf("Layer") == -1) {
        //     endpoint.url += "&Layer={Layer}"
        //     //errors.push("Missing \"{Layer}\" in WMTS endpoint");
        // }
        if (errors.length > 0) {
            console.error("Errors in WMTS endpoint", errors);
        }

        //Replace the {Layer} parameter with the layerToShow in the endpoint url
        if (endpoint.layerToShow) {
            endpoint.url = endpoint.url.replace("{Layer}", endpoint.layerToShow);
        }

        let sourceGridConf = {
            extent: layerConfig.config.value.extent || projectionExtent,
            resolutions: resolutions,
            origin: getTopLeft(projectionExtent)
        };

        let sourceConf = {
            crossOrigin: 'anonymous',
            format: endpoint.format || 'image/png',
            projection: projection,
            tileGrid: null,
            style: endpoint.style || 'default',
            layer: endpoint.layer || endpoint.layerToShow,
            opaque: false,
            transparent: true,
            url: endpoint.url
        };

        if (endpoint.matrixSet) {
            sourceConf.matrixSet = endpoint.matrixSet;
        }

        if (endpoint.matrixIds) {
            sourceGridConf.matrixIds = endpoint.matrixIds;
        }

        sourceGridConf.tileGrid = new WMTSTileGrid(sourceGridConf);

        let source = new WMTS(sourceConf);

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

        if(endpoint.hasOwnProperty("zoom") && endpoint.zoom.hasOwnProperty("min")) {
          lyr.setMinZoom(endpoint.zoom.min);
        }
    
        if(endpoint.hasOwnProperty("zoom") && endpoint.zoom.hasOwnProperty("max")) {
          lyr.setMaxZoom(endpoint.zoom.max);
        }


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