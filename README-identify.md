# Identify configuration

Identify is the process in which you determine which features are displayed on the map. Two methods of access are provided, features in view and features under pixel.

Depending on the layer type a variety of methods of determining features can be configured.

---

## OGC Services

OGC services can be querried in the following ways:
1. WMS GetFeatureInfo
1. WFS GetFeature

Both methods can determine the features under a pixel or in the entire view. Calling eith of these will return GeoJSON of all intersected features.

## ArcGIS REST Services

## MVT
A mapbox vector tile layer has the features in memory. As a result we do not need to make another request to determine the features in the view or under a pixel. If the identify configuration does **not** contain a wms or wfs configuration it will determine the features based on the this method.

### Example Configuration

```application/json
{
    "identify": {
        "wfs": "https://someserver.com/geoserver/ofs"
    }
}
```

---

## Data Mapping

Sometimes it is nice to be able to massage the data coming back f4rom the source in order to populate some values within the properties. For instance given a collection of WMS layers we can massage the properties of the features to have a unified field called "name" when each service has their own unique field to describe it. This reduces the code required for the end user by not requiring them to track which field on which service contains the data they are looking for.

Under the identify property in an endpoint you can define the data mapping by populating the dataMappingSettings value. 

dataMappingSettings : List of dataMappingSetting

dataMappingSetting: Object
- from : string - The field that is looked at for data manipulation
- to : string - The field that will be populated by the manipulation
- mode : string - The method the data is populated. Can be one of
  - copy - The data is copied from the "from" field to the "to" field. Both "from" and "to" fields exist after this mode.
  - move - The data is moved from the "from" field to the "to" field. The "from" field will not exist after this mode.
  - delete - The data in the "from" field is deleted. The "from" field will not exist after this mode.

### Example config

The resulting features from calls to getFeaturesInView and getFeaturesUnderPixel will have a name property populated with the value the the SLNAME property and the key property will be removed.

```application/json
{
    "identify": {
        ...
        "dataMappingSettings": [
            {
                "from": "SLNAME",
                "to": "name",
                "mode": "copy"
            },
            {
                "from": "key",
                "mdoe": "delete"
            }
        ]
    }
}
```