import { Tile as TileLayer } from "ol/layer.js";
import XYZ from "ol/source/XYZ";

export const generate = (layerConfig, core) => {
    let layers = layerConfig.config.value.endpoints.map(endpoint => {
        let lyr = new TileLayer({
            visible: false,
            preload: 4,
            zIndex: endpoint.zIndex || 0,
            opacity: isNaN(layerConfig.opacity) || layerConfig.opacity == null ? 1 : layerConfig.opacity,
            source: new XYZ({
                crossOrigin: 'anonymous',
                url: endpoint.url,
                maxZoom: layerConfig.config.value.maxZoom || 26,
                minZoom: layerConfig.config.value.minZoom || 1,
                tileLoadFunction: (imageTile, src) => {
                    imageTile.getImage().src = src;
                }
            })
        });
        lyr.set('id', layerConfig.key);
        lyr.set('name', layerConfig.name);

        if (endpoint.hasOwnProperty("zoom") && endpoint.zoom.hasOwnProperty("min")) {
            lyr.setMinZoom(endpoint.zoom.min);
        }

        if (endpoint.hasOwnProperty("zoom") && endpoint.zoom.hasOwnProperty("max")) {
            lyr.setMaxZoom(endpoint.zoom.max);
        }
        return lyr;
    });

    return layers;
}