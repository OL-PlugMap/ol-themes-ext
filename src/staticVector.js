import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';

import { ConfigurableStyle } from './vectorStyles'


import * as identifyUtils from './identifyUtils'




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

    let moo = new ConfigurableStyle(endpoint, source, vLayer);

    vLayer.style = moo.getStyle;
    vLayer.setStyle(moo.getStyle)

    vLayer.set('id', data.key);


    vLayer.getFeaturesInView = identifyUtils.getFeaturesInView(vLayer, endpoint, core.getMap());

    vLayer.getFeaturesUnderPixel = identifyUtils.getFeaturesUnderPixel(vLayer, endpoint, core.getMap());

    return vLayer;
  });

  layers.map(a=>a);

  return layers;
}