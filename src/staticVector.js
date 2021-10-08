import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';

import { _styleFunction } from './vectorStyles'






export const generate = (data, core) => {
    let layers = data.config.value.endpoints.map(endpoint => {
        
        let source = new VectorSource({
          maxZoom: 15,
        });

        source.highlightFeats = {};


        let vLayer = new VectorLayer({
          declutter: true,
          source: source,
          zIndex: endpoint.zIndex || 1000
        });

        vLayer.style = _styleFunction(endpoint, source, vLayer);
        vLayer.setStyle(_styleFunction(endpoint, source, vLayer))

        vLayer.set('id', data.key);
        
        return vLayer;
      });

    return layers;
}