import { get } from "ol/proj";
import { getWidth } from "ol/extent";
import ImageWMS from 'ol/source/ImageWMS.js';
import ImageLayer from "ol/layer/Image";
import { getLogger } from './logger'
import { getSldLegend } from './sharedOGC'
import ServerType from 'ol/source/WMSServerType'

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
        resolutions = new Array(zooms);
    for (let z = 0; z < zooms; ++z) {
        resolutions[z] = size / Math.pow(2, z);
    }

    let layers = layerConfig.config.value.endpoints.map(endpoint => {
        //The random adds a random value to the parameter
        //essentially cache busting
        let customParams = {
            get random() {
                return Math.random();
            }
        };


        let serverType = ServerType.GEOSERVER;
        if (endpoint.serverType) {
            switch (endpoint.serverType.toLowerCase()) {
                case "geoserver": serverType = ServerType.GEOSERVER; break;
                case "mapserver": serverType = ServerType.MAPSERVER; break;
                case "qgis": serverType = ServerType.QGIS; break;
                case "carmentaserver": serverType = ServerType.CARMENTA_SERVER; break;
            }
        }

        let source = new ImageWMS({
            params: { 'LAYERS': endpoint.layers },
            ratio: 1,
            serverType: serverType,
            resolutions: resolutions,
            projection: projection,
            url: endpoint.url,
            crossOrigin: "Anonymous"
        });

        let configureSource = function (tokenKey) {
            if (core.services && core.services[tokenKey]) {
                let tokenData = core.services[tokenKey];
                source.setUrl(`${tokenData.baseUrl || ""}${endpoint.url}`);
                if (tokenData.token) {
                    customParams["token"] = tokenData.token;
                }
                source.params_ = customParams;
            }
        }

        if (endpoint.tokenKey) {
            // if the token data has already been fetched and stored in core.services
            // go ahead and configure the source w/ the data, otherwise, postpone
            // the configuration until `setServicesCmd` has been triggered
            if (core.services && core.services[endpoint.tokenKey]) {
                configureSource(endpoint.tokenKey);
            } else {
                self.pendingConfiguration.push({
                    name: layerConfig.key,
                    fn: configureSource,
                    params: [endpoint.tokenKey]
                });
            }
        }

        let lyr = new ImageLayer({
            zIndex: endpoint.zIndex || 0,
            extent: layerConfig.config.value.extent,
            source: source
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