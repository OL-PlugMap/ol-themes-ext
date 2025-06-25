import WKT from 'ol/format/WKT';
import { transform } from 'ol/proj';

class Core {
  constructor(ele) {
    this.map = ele;
    this._plugins = [];
    this.subs = [];
    this.triggers = {};
    this.hooks = {};
    this.el = {
      itms: [],
      childrens: [],
      append: function(itm) {
        this.itms.push(itm);
      },
      appendChild: function(child) {
        this.childrens.push(child);
      }
    };
    this.services = {};
  }
  receiveMessage(event) {
    if (event.data && event.data.destination == "map") {
      if (event.data.cmd) {
        if (this.subs[event.data.cmd])
          this.subs[event.data.cmd](event.data.data);
      }
    }
  }
  init(config, elm, options) {
    this.config = config;
    this.options = options || {
      target: "ol-map",
      center: [-12350000.17245, 47051311812e-4],
      zoom: 7,
      maxZoom: 30,
      minZoom: 3
    };
    this.elm = elm;
    this._initPortSubs();
    if (!this.data)
      this.data = {};
    if (!this.data.map)
      this.data.map = this.map;
    window.addEventListener("message", this.receiveMessage.bind(this), false);
    window.mapMsg = this.receiveMessage;
    var map = this.getMap();
    if (map) {
      map.getView().on(
        "change",
        (evt) => {
          var extent = map.getView().calculateExtent(map.getSize());
          var center = map.getView().getCenter();
          center = transform(center, "EPSG:3857", "EPSG:4326");
          var extent_1 = transform([extent[0], extent[1]], "EPSG:3857", "EPSG:4326");
          var extent_2 = transform([extent[2], extent[3]], "EPSG:3857", "EPSG:4326");
          ({
            xmin: extent_1[0],
            ymin: extent_1[1],
            xmax: extent_2[0],
            ymax: extent_2[1],
            center: {
              x: center[0],
              y: center[1]
            }
          });
        }
      );
    }
    setTimeout(() => {
    }, 700);
  }
  refresh() {
    let layers = this.getMap().getLayers();
    for (let layer of layers.array_) {
      this.recursiveRefresh(layer);
    }
  }
  recursiveRefresh(layer, depth) {
    if (depth == void 0) depth = 5;
    if (depth < 0) {
      return;
    }
    if (layer.getLayers) {
      for (let layersub of layer.getLayers().array_) {
        this.recursiveRefresh(layersub, depth - 1);
      }
    } else if (layer.get("visible")) {
      if (layer.getSource) {
        var src = layer.getSource();
        if (src.tileCache) {
          src.tileCache.clear();
        }
        if (src.refreshFunction) {
          src.refreshFunction();
        } else {
          src.changed();
        }
      } else debugger;
    }
  }
  setServices(services) {
    this.services = {};
    for (let service of services) {
      this.services[service.key] = service;
    }
  }
  fitToWkt(data) {
    let wkt = data.wkt;
    var leftPadding = data.left;
    data.bottom;
    let format = new WKT();
    let feature = format.readFeature(wkt);
    let extent = feature.getGeometry().getExtent();
    let pudding = [50, 50, 50, 50 + leftPadding];
    this.data.view.cancelAnimations();
    this.data.view.fit(extent, {
      size: this.data.map.getSize(),
      duration: 1e3,
      padding: pudding
    });
  }
  fitToPointZoom(data) {
    this.data.map.getView().animate(
      {
        zoom: data.zoom,
        center: [data.x, data.y]
        //, duration: 100
      }
    );
  }
  _initPortSubs() {
  }
  render() {
  }
  register(plugins) {
    for (let pluginWithOptions of plugins) {
      let [plugin, options] = pluginWithOptions;
      this.initPlugin(plugin, options);
    }
  }
  initPlugin(Plugin, options) {
    let plugin = new Plugin();
    this._plugins.push(plugin);
    this.applyToPlugin(plugin, options);
    this.renderPlugin(plugin);
  }
  applyToPlugin(plugin, options) {
    plugin.apply(this, options);
  }
  renderPlugin(plugin) {
    if (typeof plugin !== "undefined") {
      plugin.render();
      if (this.el instanceof Element || this.el instanceof HTMLDocument) {
        this.el.append(plugin.render() || "");
      }
    }
  }
  // Stuff related to changing layers and extends plugins can hook to this and run these functions
  _changeLayer(layer) {
  }
  zoomToExtent(extent) {
    this.data.map.getView().fit(extent, {
      size: this.data.map.getSize(),
      duration: 1e3
    });
  }
  addShape(featureId) {
    this.hooks.newMessage.call(featureId);
  }
  on(name, f) {
    if (!this.triggers[name]) {
      this.triggers[name] = [];
    }
    this.triggers[name].push(f);
  }
  processTrigger(name, value) {
    if (this.triggers[name]) for (let fn of this.triggers[name]) fn(value);
  }
  getMap() {
    if (this.data) return this.data.map;
    return null;
  }
}

export { Core as default };
//# sourceMappingURL=Core.js.map
