import { get } from "ol/proj";
import { getWidth } from "ol/extent";
import { getLogger } from './logger'
import { getSldLegend } from './sharedOGC'

import VectorLayer from 'ol/layer/Vector';

import VectorSource from 'ol/source/Vector';
import GeoJSON from "ol/format/GeoJSON";
import { tile as tileStrategy } from "ol/loadingstrategy";
import { createXYZ } from "ol/tilegrid";

import { Style, Fill, Stroke } from 'ol/style';
import * as identifyUtils from './identifyUtils'

/*
*  Patch because WMSServerType is not available in 6.15 anymore
*/
const ServerType = {
  GEOSERVER: 'geoserver',
  MAPSERVER: 'mapserver',
  QGIS: 'qgis',
  CARMENTA_SERVER: 'carmentaserver',
}

// TODO: Move these to the identify utils
let _getFeaturesInView = (vtLayer, endpoint, map) => {

  if (endpoint.identify) {
    return identifyUtils.getFeaturesInView(vtLayer, endpoint, map);
  }
};

let _getFeaturesUnderPixel = (vtLayer, endpoint, map) => {

  if (endpoint.identify) {
    return identifyUtils.getFeaturesUnderPixel(vtLayer, endpoint, map);
  }
};

export const generate = (layerConfig, core) => {
  let projection = get("EPSG:3857"),
    projectionExtent = projection.getExtent(),
    size = getWidth(projectionExtent) / 256,
    zooms = 15 + 1;

  let layers = layerConfig.config.value.endpoints.map(endpoint => {


    let serverType = ServerType.GEOSERVER;
    if (endpoint.serverType) {
      switch (endpoint.serverType.toLowerCase()) {
        case "geoserver": serverType = ServerType.GEOSERVER; break;
        case "mapserver": serverType = ServerType.MAPSERVER; break;
        case "qgis": serverType = ServerType.QGIS; break;
        case "carmentaserver": serverType = ServerType.CARMENTA_SERVER; break;
      }
    }

    let layerToShow = endpoint.layerToShow;
    if (layerToShow) {
      //Convert it to a query param
      //Replace any spaces with %20
      layerToShow = layerToShow.replace(/ /g, "%20");
      //Replace any , with %2C
      layerToShow = layerToShow.replace(/,/g, "%2C");
    }

    let source = new VectorSource({
      format: new GeoJSON(),
      url: function (extent) {
        return (
          endpoint.url +
          "?service=wfs&version=1.1.0&request=GetFeature" + //Call to getFeture
          "&outputFormat=application/json&srsname=EPSG:3857" + //Ask for JSON Output in web mercator
          (layerToShow ? "&typename=" + layerToShow : "") + //If the layers to show is set (AKA the object type append it to the query)
          "&bbox=" + //Pass in the tile bbox
          extent.join(",") +
          ",EPSG:3857" //Tell it that the BBOX is web mercator
        );
      },
      strategy: tileStrategy(
        createXYZ({
          tileSize: 512
        })
      )
    });

    let lyr = new VectorLayer({
      visible: false,
      source: source,
      zIndex: endpoint.zIndex || 1000,
      style: (feature) => {
        //console.log(feature)
        return new Style({
          stroke: new Stroke({
            color: "rgba(0, 0, 255, 1.0)",
            width: 2
          }),
          fill: new Fill({
            color: "rgba(255, 0, 255, 0.5)"
          }),
        });
      }
    });

    lyr.set('id', layerConfig.key);
    lyr.set('name', layerConfig.name);

    

    if(endpoint.hasOwnProperty("zoom") && endpoint.zoom.hasOwnProperty("min")) {
      lyr.setMinZoom(endpoint.zoom.min);
    }

    if(endpoint.hasOwnProperty("zoom") && endpoint.zoom.hasOwnProperty("max")) {
      lyr.setMaxZoom(endpoint.zoom.max);
    }


    // TODO
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

    //lyr.onFeatureLoad = _onFeatureLoad(source);

    return lyr;
  });

  for(const layer of layers) {
    
  }

  return layers;
}