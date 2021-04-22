# ol-themes-ext
## Configuration driven themes management for openlayers

---
This package extends openlayers map objects to allow for a configuration driven addition of layers as well as some layer management.

This currently only supports ol 6.3. This package adds support to configure map layers into "themes" via json.

---

### Sample Usage

```javascript
import Map from 'ol/Map'
import Themes from 'ol-themes-ext'

let map = new Map({
        target: 'mapRoot',
        layers: [
          // adding a background tiled layer
          new TileLayer({
            source: new TileArcGISRest({ url: 'https://services.arcgisonline.com/arcgis/rest/services/World_Topo_Map/MapServer' })
            // source: new OSM(), // tiles are served by OpenStreetMap
          }),
        ],
        view: new View({
          center: fromLonLat([Number(-98.585522), 39.8333333]),
          zoom: 2,
          constrainResolution: true,
        }),
      });

let config =  {
    "layers": [
        {
            "key": "lyr_esri_light_gray",
            "xyz": {
                "maxZoom": 19,
                "minZoom": 3,
                "endpoints": [
                    {
                        "url": "https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
                        "bbox": null,
                        "zIndex": 10,
                        "tokenKey": null,
                        "layerDefs": null,
                        "layersToShow": null
                    }
                ]
            },
            "name": "Light Gray",
            "legend": null,
            "opacity": 1,
            "identify": null
        },
        {
            "key": "lyr_esri_streets",
            "xyz": {
                "maxZoom": 19,
                "minZoom": 3,
                "endpoints": [
                    {
                        "url": "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
                        "bbox": null,
                        "zIndex": 10,
                        "tokenKey": null,
                        "layerDefs": null,
                        "layersToShow": null
                    }
                ]
            },
            "name": "Streets",
            "legend": null,
            "opacity": 1,
            "identify": null
        },
        {
            "key": "lyr_esri_topo",
            "xyz": {
                "maxZoom": 19,
                "minZoom": 3,
                "endpoints": [
                    {
                        "url": "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
                        "bbox": null,
                        "zIndex": 10,
                        "tokenKey": null,
                        "layerDefs": null,
                        "layersToShow": null
                    }
                ]
            },
            "name": "Topo",
            "legend": null,
            "opacity": null,
            "identify": null
        },
        {
            "key": "lyr_esri_world_image",
            "xyz": {
                "maxZoom": 19,
                "minZoom": 3,
                "endpoints": [
                    {
                        "url": "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
                        "bbox": null,
                        "zIndex": 10,
                        "tokenKey": null,
                        "layerDefs": null,
                        "layersToShow": null
                    }
                ]
            },
            "name": "Aerial",
            "legend": null,
            "opacity": 1,
            "identify": null
        }
    ],
    "layerGroups": [
        {
            "key": "grp_basemaps",
            "name": null,
            "layers": [
                "lyr_esri_streets",
                "lyr_esri_world_image",
                "lyr_esri_topo",
                "lyr_esri_light_gray"
            ],
            "openness": "closed"
        },
        {
            "key": "grp_reference",
            "name": null,
            "layers": [
            ],
            "openness": "open"
        }
    ],
    "layerCategories": [
        {
            "key": "cat_basemaps",
            "name": "Basemaps",
            "hidden": false,
            "infoIcon": {
                "iconClass": "fa fa-info-circle fa-lg"
            },
            "openness": "open",
            "activeIcon": {
                "iconClass": "fa fa-circle"
            },
            "layerGroups": [
                "grp_basemaps"
            ],
            "multiphasic": false,
            "transparency": 1,
            "selectiveness": "monoselective",
            "defaultSelection": [
                "lyr_esri_world_image"
            ],
            "usesRasterLegend": false,
            "mustHaveSelection": false
        }
    ]
}

//Extend the open layers map with the themes extension
map = new Themes(map);

//Pass in the config and get an array of categories back
let categories = map.themes.initCategories(config);

let basemaps = categories[0];

//Map will add the 4 above layers in a layer group, the returned value is an array of the categories from the config

//Additionally at this point the map should be displaying the  esri world image layer

//Select the light grey layer
basemaps.selectLayer("lyr_esri_light_gray");

```