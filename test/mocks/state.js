// Shared state of the @zos/* and ZML mocks. Tests read it and call reset().
export const state = {
  widgets: [], // live widgets, in creation order
  deleted: [],
  routes: [], // { type: "push" | "back" | "home", url?, params? }
  toasts: [],
  notifications: [],
  alarms: new Map(),
  storage: new Map(),
  bleConnected: true,
  strings: {}, // getText translations; missing keys return the key
  sensors: {}, // class name -> object of getter return values
  requests: [], // { method, params } sent by pages/services via ZML request
  respond: async () => {
    throw new Error("no responder set");
  },
  calls: [], // ZML call() payloads
};

export function reset() {
  state.widgets = [];
  state.deleted = [];
  state.routes = [];
  state.toasts = [];
  state.notifications = [];
  state.alarms = new Map();
  state.storage = new Map();
  state.bleConnected = true;
  state.strings = {};
  state.sensors = {};
  state.requests = [];
  state.calls = [];
  state.respond = async () => {
    throw new Error("no responder set");
  };
}
