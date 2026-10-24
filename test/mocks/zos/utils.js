// px is identity: tests reason in design units.
export const px = (v) => v;
const logger = { log() {}, debug() {}, info() {}, warn() {}, error() {}, getLogger: () => logger };
export const log = logger;
export class EventBus {
  constructor() { this.map = new Map(); }
  on(e, cb) { (this.map.get(e) || this.map.set(e, []).get(e)).push(cb); }
  off(e) { this.map.delete(e); }
  emit(e, ...a) { (this.map.get(e) || []).forEach((cb) => cb(...a)); }
}
