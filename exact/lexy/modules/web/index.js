// `<lexy-map>` on the web (LLP 1024 D7): OpenStreetMap's embed, centred on
// the car, with its marker when `pin` is not "false". The Apple host draws
// MapKit (modules/apple/Lexy.swift); this keeps the web build (which every
// update bundle is baked from) whole. Props: latitude, longitude, zoom, pin.
export const abi = 1;
export const roster = { 'lexy-map': { snapshot: false } };

class LexyMap {
  constructor(element, props) {
    this.root = element.shadowRoot ?? element.attachShadow({ mode: 'open' });
    this.root.innerHTML = '<style>:host{display:block;position:relative;overflow:hidden;background:#dfe6ea}iframe{position:absolute;inset:0;width:100%;height:100%;border:0}</style><iframe loading="lazy" referrerpolicy="no-referrer"></iframe>';
    this.frame = this.root.querySelector('iframe');
    this.setProps(props);
  }
  setProps(props) {
    this.props = { ...this.props, ...props };
    const lat = Number(this.props.latitude ?? 0), lon = Number(this.props.longitude ?? 0);
    const zoom = Number(this.props.zoom ?? 16), span = 360 / 2 ** zoom;
    const box = [lon - span, lat - span / 2, lon + span, lat + span / 2].map((n) => n.toFixed(6)).join(',');
    const marker = this.props.pin === 'false' ? '' : `&marker=${lat.toFixed(6)},${lon.toFixed(6)}`;
    const src = `https://www.openstreetmap.org/export/embed.html?bbox=${box}&layer=mapnik${marker}`;
    if (this.frame.src !== src) this.frame.src = src;
  }
  destroy() {}
}

export function create(tag, element, json) { return new LexyMap(element, JSON.parse(json)); }
export function setProps(map, json) { map.setProps(JSON.parse(json)); }
export function destroy(map) { map.destroy(); }
