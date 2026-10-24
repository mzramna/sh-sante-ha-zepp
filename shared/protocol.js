// Watch <-> phone (app-side) contract. Pages call `this.request({ method, params })`
// (ZML BasePage); app-side answers in onRequest with res(null, result) or
// res(errorMessage). A rejected request carries that message.
//
// Entity (what the watch gets for any entity):
//   { entity_id, domain, name, state, unit, area, attributes }
//   `attributes` holds only the domain fields the watch uses, copied as HA sends them
//   (missing ones are left out), except light brightness converted to percent:
export const ENTITY_ATTRIBUTES = {
  light: ["brightness_pct", "supported_color_modes", "color_mode", "rgb_color", "effect", "effect_list"],
  media_player: ["volume_level", "is_volume_muted", "media_title", "media_artist", "media_position", "media_duration", "supported_features"],
  climate: ["hvac_modes", "hvac_action", "temperature", "current_temperature", "min_temp", "max_temp", "target_temp_step", "preset_mode", "preset_modes"],
  cover: ["current_position", "supported_features"],
  fan: ["percentage", "percentage_step", "oscillating", "preset_mode", "preset_modes"],
  vacuum: ["battery_level", "fan_speed", "fan_speed_list"],
  alarm_control_panel: ["code_format", "code_arm_required"],
  sensor: ["device_class"],
  binary_sensor: ["device_class"],
};
//   name = friendly_name || entity_id; unit = unit_of_measurement || ""; area = area name || "".

export const METHOD = {
  // {ids?: string[]} -> Entity[]; no ids: the entities the user enabled in settings.
  GET_ENTITIES: "GET_ENTITIES",
  // {entity_id} -> Entity
  GET_ENTITY: "GET_ENTITY",
  // {domain, service, entity_id, data?} -> {ok: true}
  CALL_SERVICE: "CALL_SERVICE",
  // {} -> [{area_id, name, entity_ids: string[]}]  (only enabled entities)
  GET_AREAS: "GET_AREAS",
  // {} -> {favorites: string[], sensorMode, syncInterval, saaNotifyService, saaStatusEntity}
  GET_CONFIG: "GET_CONFIG",
  // {entity_id, width, height} -> {file}  (image sent with the file transfer API)
  CAMERA_SNAPSHOT: "CAMERA_SNAPSHOT",
  // {payload} -> {interval: minutes}  (payload: shared/zepp2hass.js shape)
  SYNC_SENSORS: "SYNC_SENSORS",
};

// settings.settingsStorage keys (phone). The first three keep their 1.x names so
// existing installs keep working after the update.
export const SETTING = {
  LOCAL_URL: "localHAIP",
  EXTERNAL_URL: "externalHAIP",
  TOKEN: "HAToken",
  ENTITY_LIST: "entityList", // JSON [{key, title, value: bool}]
  FAVORITES: "favorites", // JSON string[] of entity ids
  SENSOR_MODE: "sensorMode", // "none" | "zepp2hass" | "mobile_app" | "rest"
  ZEPP2HASS_URL: "zepp2hassUrl",
  SYNC_INTERVAL: "syncInterval", // minutes, string
  MOBILE_APP: "mobileApp", // JSON registration, see app-side/mobile-app.js
  REGISTER_REQUEST: "mobileAppRegisterRequest", // written by the settings button
  REFRESH_ENTITIES: "listFetchRandom", // written by the settings button; app-side refills ENTITY_LIST
  // Sleep as Android: HA notify service of the phone running SaA and the HA Companion
  // app (e.g. "mobile_app_pixel_8"), and an entity showing the SaA state.
  SAA_NOTIFY_SERVICE: "saaNotifyService",
  SAA_STATUS_ENTITY: "saaStatusEntity",
  STATUS: "status", // JSON {ok, message} shown in settings after register/refresh
  LAST_SYNC: "lastSync", // JSON {time, ok, error?}
};
