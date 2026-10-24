import { BaseSideService } from "@zeppos/zml/base-side";
import { METHOD, SETTING } from "../shared/protocol.js";
import * as ha from "./ha.js";
import * as mobileApp from "./mobile-app.js";
import { syncSensors } from "./sensors.js";
import { cameraSnapshot } from "./camera.js";

// handler(params, service) -> result | Promise<result>; a throw becomes the error message.
/** @type {Record<string, (params: any, service?: any) => any>} */
const HANDLERS = {
  [METHOD.GET_ENTITIES]: ha.getEntities,
  [METHOD.GET_ENTITY]: ha.getEntity,
  [METHOD.CALL_SERVICE]: ha.callService,
  [METHOD.GET_AREAS]: ha.getAreas,
  [METHOD.GET_CONFIG]: ha.getConfig,
  [METHOD.CAMERA_SNAPSHOT]: cameraSnapshot,
  [METHOD.SYNC_SENSORS]: syncSensors,
};

// Buttons on the settings page write these keys; the side service does the work.
const SETTING_ACTIONS = {
  [SETTING.REFRESH_ENTITIES]: ha.refreshEntityList,
  [SETTING.REGISTER_REQUEST]: mobileApp.register,
};

const setStatus = (ok, message) =>
  settings.settingsStorage.setItem(SETTING.STATUS, JSON.stringify({ ok, message, time: Date.now() }));

AppSideService(
  BaseSideService({
    onInit() {},

    onRequest(req, res) {
      const handler = HANDLERS[req.method];
      if (!handler) return res(`Unknown method ${req.method}`);
      Promise.resolve()
        .then(() => handler(req.params || {}, this))
        .then(
          (result) => res(null, result),
          (e) => res((e && e.message) || String(e))
        );
    },

    onSettingsChange({ key }) {
      const action = SETTING_ACTIONS[key];
      if (!action) return;
      Promise.resolve()
        .then(() => action())
        .then(
          (message) => setStatus(true, message || "OK"),
          (e) => setStatus(false, (e && e.message) || String(e))
        );
    },

    onRun() {},
    onDestroy() {},
  })
);
