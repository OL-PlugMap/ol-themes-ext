import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';

import { ConfigurableStyle } from './vectorStyles'






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

        let moo = new ConfigurableStyle(endpoint, source, vtLayer);

        vLayer.style = moo.getStyle;
        vLayer.setStyle(moo.getStyle)

        vLayer.set('id', data.key);
        
        return vLayer;
      });

    return layers;
}