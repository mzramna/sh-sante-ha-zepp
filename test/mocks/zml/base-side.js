import { state } from "../state.js";

export function BaseSideService(options) {
  return {
    ...options,
    call(data) {
      state.calls.push(data);
    },
    download(url, opts) {
      state.requests.push({ method: "download", params: { url, opts } });
      return Promise.resolve().then(() => state.respond({ method: "download", params: { url, opts } }));
    },
    sendFile(path, opts) {
      state.requests.push({ method: "sendFile", params: { path, opts } });
      return { on() {} };
    },
  };
}
