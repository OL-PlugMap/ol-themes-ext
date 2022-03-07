import { get } from "ol/proj";
import { getWidth } from "ol/extent";
import { getLogger } from './logger'
import { getSldLegend } from './sharedOGC'
import WMTS from "ol/source/WMTS";
import WMTSTileGrid from "ol/tilegrid/WMTS";
import { Tile as TileLayer } from "ol/layer.js";



export const generate = (layerConfig, core) => {
    var projection = get("EPSG:3857"),
        projectionExtent = projection.getExtent(),
        size = getWidth(projectionExtent) / 256,
        zooms = 15 + 1,
        resolutions = new Array(zooms),
        matrixIds = new Array(zooms);
    for (let z = 0; z < zooms; ++z) {
        resolutions[z] = size / Math.pow(2, z);
        matrixIds[z] = z;
    }

    let layers = layerConfig.config.value.endpoints.map(endpoint => {

        let errors = [];
        if (!endpoint.url || endpoint.url.indexOf("{TileMatrixSet}") == -1) {
            errors.push("Missing \"{TileMatrixSet}\" in WMTS endpoint");
        }
        if (!endpoint.url || endpoint.url.indexOf("{TileMatrix}") == -1) {
            errors.push("Missing \"{TileMatrix}\" in WMTS endpoint");
        }
        if (!endpoint.url || endpoint.url.indexOf("{TileRow}") == -1) {
            errors.push("Missing \"{TileRow}\" in WMTS endpoint");
        }
        if (!endpoint.url || endpoint.url.indexOf("{TileCol}") == -1) {
            errors.push("Missing \"{TileCol}\" in WMTS endpoint");
        }
        if (errors.length > 0) {
            console.error("Errors in WMTS endpoint", errors);
        }

        let source = new WMTS({
            crossOrigin: 'anonymous',
            matrixSet: 'webmercator',
            format: 'image/png',
            projection: projection,
            requestEncoding: 'REST',
            tileGrid: new WMTSTileGrid({
                extent: layerConfig.config.value.extent,
                resolutions: resolutions,
                matrixIds: matrixIds
            }),
            style: 'default',
            opaque: false,
            transparent: true,
            url: endpoint.url
        });
        let configureSource = function (tokenKey) {
            if (core.services && core.services[tokenKey]) {
                let tokenData = core.services[tokenKey];
                source.setUrl(`${tokenData.baseUrl || ""}${endpoint.url}`);
                source.setTileLoadFunction(function (imageTile, src) {
                    imageTile.getImage().src = `${src}?token=${tokenData.token || ""}`;
                });
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

            debugger;

            if ((layerConfig.legend?.enabled && layerConfig.legend?.method === 'sld') || (endpoint.legend && endpoint.legend.method === 'sld')) {
                endpoint.legendEntries = await getSldLegend(endpoint);
            }


            return endpoint.legendEntries;
        }

        return lyr;
    });

    return layers;
}