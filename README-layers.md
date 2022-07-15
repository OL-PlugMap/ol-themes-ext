# Layer Configuration
Fields:

The following are required: 

1. key - String - the key in which this layer is referred to, these must be unique
1. name - String - the name in which the layer is referred to, commonly used in UI components for what to display
1. opacity - Float - the starting opacity of the layer

Depending on the layer type you are trying to configure one of the following keys must be present:

1. xyz
1. mvt
1. wms
1. wmts
1. wfs
1. esriExport/esriMapService
1. esriFeature/esriFeatureService
1. staticVector

The specific configuration for each of these is listed further below. Common attributes:

1. endpoints - List of [Endpoint](#endpoint)
1. legend - [Legend](#legend)
1. identify - [Identify](#identify)



# Layer Types
## xyz

An XYZ layer is a tile layer in which the tiles are typically accessed via an X, Y , and a Z in the URL. ArcGIS basemaps are hosted as an XYZ. Therefore an example of making use of the Light Grey basemap by ESRI would be to use the following configuration.

```JSON
{
    "key": "lyr_esri_light_grey",
    "xyz": {
        "endpoints": [
            {
                "url": "https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}"
            }
        ]
    },
    "name": "Light Gray",
    "opacity": 1
}
```

The result of using an XYZ layer type is a [TileLayer](https://openlayers.org/en/latest/apidoc/module-ol_layer_Tile-TileLayer.html) with an [XYZ Source](https://openlayers.org/en/latest/apidoc/module-ol_source_XYZ-XYZ.html).


## mvt

A Mapbox Vector Tile is a vector layer that has been tiles and hosted in the [MVT Specification](https://github.com/mapbox/vector-tile-spec). MVT layers typically need less bandwidth to transfer a tile as opposed to a rendered image tile. A tile contains a set of features with their geometry and properties. 



The result of using a MVT layer type is a [VectorTileLayer](https://openlayers.org/en/latest/apidoc/module-ol_layer_MapboxVector-MapboxVectorLayer.html) with a [VectorTileSource](https://openlayers.org/en/latest/apidoc/module-ol_source_VectorTile-VectorTile.html)


# Endpoint

The endpoint configurations tell the system the source of the layer

1. URL - String - Where the layer is hosted
1. zIndex - Integer - The level in which the layer is rendered. The high the number the closer to the top the layer is
1. zoom: - [Zoom](#zoom) - Configuration for the zoom levels
    1. min - Integer - Minimum zoom level to render the layer at
    1. max - Integer - Maximum zoom level to render the layer at

# Zoom

When the zoom configuration is set for an endpoint the system will populate the maxZoom and minZoom in openlayers. These settings determine if the layer will be rendered or not. See minZoom and maxZoom [here](https://openlayers.org/en/latest/apidoc/module-ol_layer_Base-BaseLayer.html) and an example [here](https://openlayers.org/en/latest/examples/layer-zoom-limits.html).

Note from the documentation that the minZoom is **exclusive** and maxZoom is **inclusive**. This means if you have two layers that you want to switch between, the maxZoom if the layer to be transitioned out should match the minZoom of the layer to be transitioned in.

If you configure multiple endpoints within a layer and setup the zoom configuration, you can have the layers change at different zoom levels. A use case is to have a grid of features at different scale dependencies. For further out zooms you can have a larger grid and closer in zoom a smaller grid. 

Example Config

```JSON
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
                    "min": 8,
                    "max": 14
                }
            },
            {
                "url": "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
                "zIndex": 10,
                "zoom": {
                    "min": 14
                }
            }
        ]
    },
    "name": "Light Gray to Topo To Streets",
    "opacity": 1,
},
```
This will result in an XYZ layer starting with ESRI light gray and switching over to ESRI topo once zoom level **9** has been reached. Once level **15** has been reached the layer will switch over to the ESRI world street.

# Legend

When configured, this will create a getLegend method on the returned layers. The method in which the legend is interpreted depends on the configuration and the type of layer.

The configuration can be setup to be a static legend in the event you do not need to reach out to some other service. In this case set the legendEntries on the endpoints to a list of legend entry.



# Identify

[Main Page](README-identify.md)

Identify Stuff Here

See getFeaturesInView and getFeaturesUnderPixel below


---

# Layer

This object extends the resulting layer from openlayers. For common methods and properties see [this](https://openlayers.org/en/latest/apidoc/module-ol_layer_Base-BaseLayer.html)

Added Methods:

1. async getLegend() - Returns a promise that will resolve to a list of [LegendEntry](#legendEntry)
1. async getFeaturesInView() - Returns a promise that will resolve to a list of features within the curent view.
1. async getFeaturesUnderPixel([x,y]) - Returns a promise that will resolve to a list of features under the pixel.


# LegendEntry

This objects represents an entry for a legend. A legend is typically a list of these objects. 

Fields:
1. todo