// Direct watch Wi-Fi HTTP requests to Home Assistant with transparent BLE fallback.
// When the watch has an active Wi-Fi connection (`globalThis.fetch` available) and
// cached Home Assistant credentials in `localStorage`, requests go straight from the
// watch to Home Assistant (LAN URL first, then external URL) for lower latency.
// If Wi-Fi is unavailable or fails, `requestOrDirect` falls back to `page.request(...)` (BLE).
import { localStorage } from "@zos/storage";
import { METHOD, ENTITY_ATTRIBUTES } from "../shared/protocol.js";
import { ENTITY_ID, NAME } from "../shared/validate.js";
import { filterEnergy } from "./groups.js";
import { SENSOR_DEFS, getPath } from "../shared/zepp2hass.js";

const KEY_HA_CONFIG = "ha_direct_config";
const TIMEOUT_MS = 4000;

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
const isEntityId = (id) => typeof id === "string" && ENTITY_ID.test(id);
const isName = (s) => typeof s === "string" && NAME.test(s);

export function saveDirectConfig(cfg) {
  if (!cfg || typeof cfg !== "object") return;
  try {
    const prev = loadDirectConfig();
    const merged = { ...prev, ...cfg };
    localStorage.setItem(KEY_HA_CONFIG, JSON.stringify(merged));
  } catch (e) {
    // Ignore storage block
  }
}

export function loadDirectConfig() {
  try {
    const raw = /** @type {any} */ (localStorage).getItem(KEY_HA_CONFIG, "");
    return raw ? JSON.parse(raw) || {} : {};
  } catch (e) {
    return {};
  }
}

export function joinUrl(base, path) {
  return String(base || "").replace(/\/+$/, "") + "/" + String(path || "").replace(/^\/+/, "");
}

export function directBaseUrls(cfg = loadDirectConfig()) {
  return [cfg.localUrl, cfg.externalUrl]
    .filter((u) => typeof u === "string" && u.trim() !== "")
    .map((u) => u.trim());
}

export function canDirectHa(cfg = loadDirectConfig()) {
  if (typeof globalThis.fetch !== "function") return false;
  return directBaseUrls(cfg).length > 0 && Boolean(cfg.token);
}

export function toEntity(raw) {
  const id = raw.entity_id;
  const a = Array.isArray(raw.attributes) ? Object.fromEntries(raw.attributes) : raw.attributes || {};
  const domain = id.split(".")[0];
  const keys = hasOwn(ENTITY_ATTRIBUTES, domain) ? ENTITY_ATTRIBUTES[domain] : [];
  const attributes = {};
  for (const key of keys) {
    if (a[key] !== undefined) attributes[key] = a[key];
  }
  if (domain === "light") {
    if (typeof a.brightness === "number") {
      attributes.brightness_pct = Math.round((a.brightness / 255) * 100);
    }
    if (attributes.hs_color !== undefined && attributes.hs_color !== null) {
      attributes.hs_color = Array.isArray(attributes.hs_color) ? attributes.hs_color : Array.from(attributes.hs_color);
    }
    if (attributes.rgb_color !== undefined && attributes.rgb_color !== null) {
      attributes.rgb_color = Array.isArray(attributes.rgb_color) ? attributes.rgb_color : Array.from(attributes.rgb_color);
    }
  }
  return {
    entity_id: id,
    domain,
    name: a.friendly_name || id,
    state: raw.state,
    unit: a.unit_of_measurement || "",
    area: raw.area || "",
    attributes,
  };
}

/** @param {string} url @param {{method?: string, headers?: Record<string, string>, body?: any, timeout?: number}} [opts] */
export async function directFetch(url, { method = "GET", headers = {}, body, timeout = TIMEOUT_MS } = {}) {
  const fetchFn = /** @type {any} */ (globalThis.fetch);
  const res = await fetchFn({
    url,
    method,
    timeout,
    headers: { "Content-Type": "application/json", ...headers },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
  if (!res || !res.status) throw new Error(`No response from ${url}`);
  let data = res.body;
  if (typeof data === "string" && data !== "") {
    try {
      data = JSON.parse(data);
    } catch (e) {
      // keep plain text
    }
  }
  if (res.status < 200 || res.status >= 300) {
    const err = new Error(`HTTP ${res.status}`);
    /** @type {any} */ (err).status = res.status;
    throw err;
  }
  return data;
}

/** @param {string} path @param {{method?: string, headers?: Record<string, string>, body?: any}} [opts] @param {any} [cfg] */
export async function directHaRequest(path, opts = {}, cfg = loadDirectConfig()) {
  const urls = directBaseUrls(cfg);
  if (!urls.length || !cfg.token) throw new Error("Direct HA credentials not available");
  let lastErr;
  for (const base of urls) {
    try {
      return await directFetch(joinUrl(base, path), {
        ...opts,
        headers: { Authorization: `Bearer ${cfg.token}`, ...opts.headers },
      });
    } catch (e) {
      if (e && typeof /** @type {any} */ (e).status === "number") throw e;
      lastErr = e;
    }
  }
  throw lastErr || new Error("Direct HA connection failed");
}

const REST_SENSORS = ["heart_rate", "heart_rate_resting", "battery", "steps", "calories", "distance", "pai"];

export async function directSyncSensors(payload, cfg = loadDirectConfig()) {
  if (!payload || typeof payload !== "object") throw new Error("No sensor payload");
  const mode = cfg.sensorMode || "none";
  if (mode === "none") return { disabled: true };
  const interval = Number(cfg.syncInterval) || 5;

  if (mode === "zepp2hass") {
    if (!cfg.zepp2hassUrl) throw new Error("zepp2hass webhook URL not set");
    const res = await directFetch(cfg.zepp2hassUrl, { method: "POST", body: payload });
    if (!res || res.status !== "ok") throw new Error("Unexpected response from zepp2hass");
    return { interval };
  }

  if (mode === "rest") {
    const device =
      String((payload.device && payload.device.deviceName) || "zepp")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "") || "zepp";
    for (const def of SENSOR_DEFS) {
      const value = getPath(payload, def.path);
      if (value === undefined || !REST_SENSORS.includes(def.unique_id)) continue;
      await directHaRequest(
        `/api/states/sensor.${device}_${def.unique_id}`,
        {
          method: "POST",
          body: {
            state: value,
            attributes: {
              friendly_name: def.name,
              unit_of_measurement: def.unit,
              icon: def.icon,
              state_class: def.state_class,
            },
          },
        },
        cfg
      );
    }
    return { interval };
  }

  throw new Error(`Direct sync not supported for mode: ${mode}`);
}

/** @param {string} method @param {Record<string, any>} [params] @param {any} [cfg] */
export async function tryDirectMethod(method, params = {}, cfg = loadDirectConfig()) {
  if (method === METHOD.SYNC_SENSORS) {
    if (typeof globalThis.fetch !== "function") throw new Error("No watch fetch");
    const mode = cfg.sensorMode;
    if (mode === "zepp2hass" && cfg.zepp2hassUrl) {
      return directSyncSensors(params.payload, cfg);
    }
    if (mode === "rest" && canDirectHa(cfg)) {
      return directSyncSensors(params.payload, cfg);
    }
    throw new Error("Direct sensor sync unavailable");
  }

  if (!canDirectHa(cfg)) throw new Error("Direct HA unavailable");

  if (method === METHOD.GET_ENTITY) {
    const { entity_id } = params;
    if (!isEntityId(entity_id)) throw new Error("Invalid entity_id");
    const raw = await directHaRequest(`/api/states/${entity_id}`, {}, cfg);
    return toEntity(raw);
  }

  if (method === METHOD.CALL_SERVICE) {
    const { domain, service, entity_id, data = {} } = params;
    if (!isName(domain) || !isName(service)) throw new Error("Invalid service");
    await directHaRequest(
      `/api/services/${domain}/${service}`,
      { method: "POST", body: { entity_id, ...data } },
      cfg
    );
    return { ok: true };
  }

  if (method === METHOD.GET_ENTITIES) {
    const wanted = Array.isArray(params.ids) ? params.ids.filter(isEntityId) : (cfg.enabledIds || []).filter(isEntityId);
    if (!wanted.length) throw new Error("No entity ids cached for direct fetch");
    const states = await directHaRequest("/api/states", {}, cfg);
    const byId = new Map((Array.isArray(states) ? states : []).map((s) => [s.entity_id, s]));
    return wanted.filter((id) => byId.has(id)).map((id) => toEntity(byId.get(id)));
  }

  if (method === METHOD.GET_ENERGY) {
    const states = await directHaRequest("/api/states", {}, cfg);
    const sensorStates = (Array.isArray(states) ? states : []).filter((s) => s.entity_id && s.entity_id.startsWith("sensor."));
    return filterEnergy(sensorStates.map(toEntity));
  }

  throw new Error(`Method ${method} requires phone bridge`);
}

// Attempts direct Wi-Fi execution on the watch first when credentials are cached in localStorage,
// falling back transparently to the ZML phone BLE bridge (`requester.request`).
// Also caches credentials whenever `GET_CONFIG` answers with them.
/** @param {any} requester @param {{method: string, params?: any}} req @param {any} [opts] */
export async function requestOrDirect(requester, req, opts) {
  const { method, params = {} } = req || {};
  if (method !== METHOD.GET_CONFIG && method !== METHOD.SET_ENTITY_VISIBILITY && method !== METHOD.CAMERA_SNAPSHOT) {
    const cfg = loadDirectConfig();
    if (canDirectHa(cfg) || (method === METHOD.SYNC_SENSORS && typeof globalThis.fetch === "function" && cfg.zepp2hassUrl)) {
      try {
        return await tryDirectMethod(method, params, cfg);
      } catch (e) {
        // Wi-Fi failed or unavailable — fall back to phone BLE bridge
      }
    }
  }
  const res = opts !== undefined ? await requester.request(req, opts) : await requester.request(req);
  if (method === METHOD.GET_CONFIG && res && typeof res === "object") {
    saveDirectConfig(res);
  }
  return res;
}
