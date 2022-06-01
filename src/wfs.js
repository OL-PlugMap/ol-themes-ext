import { get } from "ol/proj";
import { getWidth } from "ol/extent";
import {getLogger} from './logger'
import {getSldLegend} from './sharedOGC'
import ServerType from 'ol/source/WMSServerType'

import VectorLayer from 'ol/layer/Vector';

import VectorSource from 'ol/source/Vector';
import GeoJSON from "ol/format/GeoJSON";
import { tile as tileStrategy, bbox as bboxStrategy } from "ol/loadingstrategy";
import { createXYZ } from "ol/tilegrid";

//TODO this should use the existing vectorStyle function
import { Style, Fill, Stroke, Circle as CircleStyle, Text } from 'ol/style';


let _getFeaturesInView = (vtLayer, map) => {
    return async () => {
      return getLoadingPromise(vtLayer).then(async () => {
        let features = vtLayer.getSource().getFeaturesInExtent(map.getView().calculateExtent());
        
        let ret = _deduplicateFeatures(features);
  
        return ret;
      });
    }
  };
  
let _getFeaturesUnderPixel = (vtLayer, map) => {
    return async (pixel, event) => {
      if(!pixel || !Array.isArray(pixel) || pixel.length != 2)
      {
        console.warn("Invalid parameter provided to getFeaturesUnderPixel. Expected an array with a length of 2. Got", pixel);
      }
      getLogger()("Getting features at", pixel);
      return getLoadingPromise(vtLayer).then(async () => {
        getLogger()("Loaded tiles, calling getFeatures");
        
        let coords = map.getCoordinateFromPixel(pixel);
        getLogger()("Coords", coords);
  
        let zoom = map.getView().getZoom();
        getLogger()("Zoom", zoom);
  
        let buf = (25 - zoom);
  
        switch(zoom)
        {
          case 1:
          case 2:
          case 3:
          case 4:
          case 5:
          case 6:
            buf = 100; break;
          case 7:
          case 8:
          case 9:
          case 10:
            buf = 50; break;
          case 11:
          case 12:
          case 13:
          case 14:
          case 15:
            buf = 20; break;
          case 16:
          case 17:
          case 18:
          case 19:
          case 20:
          case 21:
          case 22:
          case 23:
          case 24:
            buf = 10; break;
          default: buf = 1; break;
        }
  
        if(buf <= 0) buf = 1;
        getLogger()("buf", buf);
  
        let ext = [coords[0]-buf,coords[1]-buf,coords[0]+buf,coords[1]+buf]
        getLogger()("ext", ext);
  
        let features = vtLayer.getSource().getFeaturesInExtent(ext);
        //let features = await vtLayer.getFeatures(pixel);
        getLogger()("Got features", features);
        
        let ret = _deduplicateFeatures(features);
        getLogger()("Deduplicated", ret);
  
        return ret;
      });
    }
  };

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
            url: function(extent) {
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


        // TODO
        lyr.getLegend = async function () {
            
            if (endpoint.legendEntries) {
              return endpoint.legendEntries;
            }
      
            if((layerConfig.legend?.enabled && layerConfig.legend?.method === 'sld') || (endpoint.legend && endpoint.legend.method === 'sld')) {
                endpoint.legendEntries = await getSldLegend(endpoint);
            }
            
      
            return endpoint.legendEntries;
          }


        lyr.getFeaturesInView = _getFeaturesInView(lyr, core.getMap())

        lyr.getFeaturesUnderPixel = _getFeaturesUnderPixel(lyr, core.getMap());

        return lyr;
    });

    return layers;
}