// This provides shared functions for OGC layers.

import {getLogger} from './logger'
/*
    Where SLD is enabled this function can be called to get legend entries

*/
export const getSldLegend = async (endpoint) => {
    try {
        // Cal to the legend endpoint\
        let legendUrl = `${endpoint.url}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetStyles&LAYERS=${endpoint.layers.join(',')}`;
        
        let legendValuesXML = await (await fetch(legendUrl)).text();
        
        //Convert the XML to JSON
        let parser = new DOMParser();
        let xmlDoc = parser.parseFromString(legendValuesXML, "text/xml");
        
        let legendRoot = xmlDoc.getElementsByTagName("sld:ColorMap");

        //Under the root there are sld:ColorMapEntry elements
        let legendEntries = legendRoot[0].getElementsByTagName("sld:ColorMapEntry");

        let legendValues = [];
        // Each element has a color, opacity, quantity, and label as attributes
        for(let i = 0; i < legendEntries.length; i++) {
            let legendEntry = legendEntries[i];

            let color = legendEntry.getAttribute("color");
            let opacity = legendEntry.getAttribute("opacity");
            let quantity = legendEntry.getAttribute("quantity");
            let label = legendEntry.getAttribute("label");

            //If the opacity is not 1.0 then we need to convert the color to rgba
            //If the color is hex turn it into rgb
            if(opacity != 1.0 && opacity > 0){
                if(color.startsWith("#")){
                    color = color.substring(1);
                    color = parseInt(color, 16);
                    color = [(color >> 16) & 255, (color >> 8) & 255, color & 255];
                }
                color = `rgba(${color[0]},${color[1]},${color[2]},${opacity})`;
            } else if (opacity == 0) {
                color = undefined;
            }

            legendValues.push( {
                color,
                opacity,
                value: quantity,
                label
            });
        };

        return legendValues;
        
      }
      catch (ex) {
        getLogger()("Error getting legend", ex);
      }
}