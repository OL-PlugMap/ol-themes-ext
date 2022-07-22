# ol-themes-ext
## Configuration driven themes management for openlayers

---
This package extends openlayers map objects to allow for a configuration driven addition of layers as well as some layer management.

This currently only supports ol 6.14. This package adds support to configure map layers into "themes" via json.

### Live Sample
https://codesandbox.io/s/ol-themes-ext-v003-example-gvgr2

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
            "key": "lyr_auto_basemap",
            "xyz": {
                "endpoints": [
                    {
                        "url": "https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
                        "zIndex": 10,
                        "zoom": {
                            "max": 8
                        }
                    },
                    {
                        "url": "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
                        "zIndex": 10,
                        "zoom": {
                            "min": 8
                        }
                    }
                ]
            },
            "name": "Light Gray to Topo",
            "opacity": 1,
        },
        {
            "key": "lyr_esri_streets",
            "xyz": {
                "endpoints": [
                    {
                        "url": "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
                        "zIndex": 10
                    }
                ]
            },
            "name": "Streets",
            "opacity": 1,
        },
        {
            "key": "lyr_esri_world_image",
            "xyz": {
                "endpoints": [
                    {
                        "url": "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
                        "zIndex": 10,
                    }
                ]
            },
            "name": "Aerial",
            "opacity": 1,
        }
    ],
    "layerGroups": [
        {
            "key": "grp_basemaps",
            "name": null,
            "layers": [
                "lyr_esri_streets",
                "lyr_esri_world_image",
                "lyr_auto_basemap"
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

let basemaps = map.getCategoryByKey("cat_basemaps");

//Map will add the 4 above layers in a layer group, the returned value is an array of the categories from the config

//Additionally at this point the map should be displaying the  esri world image layer

//Select the auto basemap layer
// This layer will switch from light grey to topo at zoom level 8
basemaps.selectLayer("lyr_auto_basemap");


//For a MVT layer you can run this to get all the features currently rendered
let featuresInView = my_mvt_layer.getFeaturesInView();

//For a MVT layer you can tie to a click event to get the features clicked on
map.on('click', async function (evt) {
    let featuresClickedOn = await my_mvt_layer.getFeaturesUnderPixel(evt.pixel);
});

//Filtering
// Suppose you have a category with a key of cat_test
// In that category you have a layer with a key of lyr_test
// The layer's features have a property named "County"
// The property contains a string representation of the county in which the feature lies

// One could filter the displayed features to a county named or containing "Iron" by doing the following
window.map.themes.getCategoryByKey("cat_test").getLayerByKey("lyr_test").filter.when("County").contains("Iron");

// If you wanted only "Iron" exactly
window.map.themes.getCategoryByKey("cat_test").getLayerByKey("lyr_test").filter.when("County").exactly("Iron");

// If you want to display any feature that was in Iron or Cache or any combination of the two
window.map.themes.getCategoryByKey("cat_test").getLayerByKey("lyr_test").filter.when("County").containsAny([ "Iron", "Cache" ]);

// If you later decide to remove the filter on the county field you can call clear on when
window.map.themes.getCategoryByKey("cat_test").getLayerByKey("lyr_test").filter.when("County").clear();

// Or If you want to remove all filters
window.map.themes.getCategoryByKey("cat_test").getLayerByKey("lyr_test").filter.clear();

```




---
## Changelog
- 0.1.19
    - Better support for legend in vector layers with a custom style defined
    - Update to ol 6.15.1
    - Fixed issue with styling using patterns in vector layers
- 0.1.18
    - Basic support for legend on mvt layers
- 0.1.16
    - (+) added support for zoom levels within an endpoint. You can have multiple endpoints that are switched between automatically based on the zoom level
- 0.1.12
    - (+) Added identify support to wms and wfs
- 0.1.11
    - (+) Added deselctAll function to category
- 0.1.9
    - (+) Added support for WFS layers
- 0.1.6
    - (+) Added SLD legend support on WMS
- 0.1.4
    - (+) starting adding support for legend
- 0.1.2
    - (+) configuration is applied as a property of generated layers so additional values can be accessed outside of ol-themes-ext
- 0.1.1
    - (*) Discovered the wonders of the files property in package.json to include all the required files
- 0.1.0
    - (-) Removed webpack bundling fromt he build process, the package should be significantly smaller now
- 0.0.31
    - (+) Added support for configurable highlight styles on vector layers
    - (*) Revamped the vector styles to solve an issue related to global pollution a rewrite is close
- 0.0.30
    - (*) Fixed a bug with wms and wmts when there are no token services
- 0.0.29
    - (+) rewrote a portion of the library so that the returned categories have their metadata and groups and each of the groups have their metadata and layers and each of the layers have their metadata
    - (*) fixed a bug where getFeaturesInView would return before all tiles were loaded
- 0.0.26
    - (*) General bugfixes
- 0.0.25
    - (+) Added cross fade
    - (*) Fixed an issue with highlighting on statically styled vector layers
- 0.0.24
    - (+) Added text options for adding labels to vector layers
    - (*) Improved static styling performance a little
- 0.0.23
    - (*) Changed how filters are applied so it also can be used on layers with a static styling
    - (+) Added a check to the getFeaturesUnderPixel call to ensure you pass in the proper data type
- 0.0.22
    - (*) Fixed an issue where if an empty set is provided to the filters it still failed to filter
- 0.0.21
    - (+) Added a null check for category opacity
    - (*) Inverted logic on filtering so that contains all ([]) returns true
    - (*) Removed features with no property matching filter
- 0.0.20
    - (*) Fixed a couple typos in the filter engine
    - (+) Added a clear on the when clause of the filter engine so you can clear a single filtered field
- 0.0.19
    - (*) Fixed a bug where Esri Feature Services wouldn't take the configured opacity
- 0.0.17
    - Changed optional chaining property accessors to regular accessors for the time being as webpack was throwing a fit
- 0.0.16
    - (+) Added initial support for filtering esri map service (export) layers
- 0.0.15
    - (+) Added initial support for filtering on MVT layers
- 0.0.14
    - (*) Fixed an issue with monoselection keys
- 0.0.13
    - (+) Added some support for the esri feature service renderers via 0l-esri-style
- 0.0.12 (And 11 lol)
    - Fixed an issue with clicking on multiple features from a MVT layer. The default ol function only returned the topmost feature.
- 0.0.10
    - (+) Added support for static vector layers so you can use the same styling function for dynamic data
    - Removed some logs
- 0.0.9
    - (+) Added support for a pattern fill
- 0.0.8
    - Bugfix for tile loading functions
- 0.0.7
    - (+) Added getCategoryByKey and getCategories to the map object
    - (+) Added getLayerByKey to the category object
    - (+) Added metadata to the layer object 
    - Modified getFeaturesInView and getFeaturesUnderPixel to await the tiles to be loaded
- 0.0.6
    - (+) Added getFeaturesInView to mvt layers
    - (+) Added async getFeaturesUnderPixel to mvt layers
- 0.0.5
  - Cleaned up code a bit
  - Removed excessive logging
  - Fixed a bug in the selection code
---