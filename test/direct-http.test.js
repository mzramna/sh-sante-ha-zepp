import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { state, reset } from "./helpers/watch.js";
import { METHOD } from "../shared/protocol.js";
import {
  saveDirectConfig,
  loadDirectConfig,
  canDirectHa,
  directBaseUrls,
  joinUrl,
  toEntity,
  directFetch,
  directHaRequest,
  directSyncSensors,
  tryDirectMethod,
  requestOrDirect,
} from "../utils/direct-http.js";

const realFetch = globalThis.fetch;

beforeEach(() => {
  reset();
  delete globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  reset();
});

test("saveDirectConfig and loadDirectConfig persist and merge config in localStorage", () => {
  assert.deepEqual(loadDirectConfig(), {});
  saveDirectConfig(null);
  assert.deepEqual(loadDirectConfig(), {});

  saveDirectConfig({ localUrl: "http://192.168.1.10:8123", token: "tok123" });
  assert.deepEqual(loadDirectConfig(), { localUrl: "http://192.168.1.10:8123", token: "tok123" });

  saveDirectConfig({ externalUrl: "https://ha.example.com" });
  assert.deepEqual(loadDirectConfig(), {
    localUrl: "http://192.168.1.10:8123",
    externalUrl: "https://ha.example.com",
    token: "tok123",
  });
});

test("canDirectHa requires both fetch and cached credentials", () => {
  saveDirectConfig({ localUrl: "http://192.168.1.10:8123", token: "tok123" });
  assert.equal(canDirectHa(), false, "no fetch on watch");

  globalThis.fetch = async () => ({ status: 200, body: "{}" });
  assert.equal(canDirectHa(), true);
  assert.deepEqual(directBaseUrls(), ["http://192.168.1.10:8123"]);
  assert.equal(joinUrl("http://192.168.1.10:8123/", "/api/states"), "http://192.168.1.10:8123/api/states");
});

test("toEntity maps attributes, brightness_pct, hs_color, and rgb_color", () => {
  const ent = toEntity({
    entity_id: "light.desk",
    state: "on",
    attributes: {
      friendly_name: "Desk",
      brightness: 255,
      hs_color: [120, 100],
      rgb_color: [0, 255, 0],
    },
  });
  assert.equal(ent.name, "Desk");
  assert.equal(ent.attributes.brightness_pct, 100);
  assert.deepEqual(ent.attributes.hs_color, [120, 100]);
  assert.deepEqual(ent.attributes.rgb_color, [0, 255, 0]);
});

test("directHaRequest tries LAN URL first and falls back to external URL on network error", async () => {
  const urls = [];
  globalThis.fetch = async (opts) => {
    urls.push(opts.url);
    if (opts.url.startsWith("http://192.168")) throw new Error("LAN unreachable");
    return { status: 200, body: JSON.stringify({ entity_id: "light.a", state: "on", attributes: { friendly_name: "A" } }) };
  };
  const cfg = { localUrl: "http://192.168.1.10:8123", externalUrl: "https://ha.example.com", token: "secret" };
  const entity = await tryDirectMethod(METHOD.GET_ENTITY, { entity_id: "light.a" }, cfg);
  assert.equal(entity.name, "A");
  assert.deepEqual(urls, [
    "http://192.168.1.10:8123/api/states/light.a",
    "https://ha.example.com/api/states/light.a",
  ]);
});

test("tryDirectMethod handles CALL_SERVICE, GET_ENTITIES, and GET_ENERGY over watch Wi-Fi", async () => {
  const calls = [];
  globalThis.fetch = async (opts) => {
    calls.push(opts);
    if (opts.url.endsWith("/api/services/light/turn_on")) {
      return { status: 200, body: "[]" };
    }
    if (opts.url.endsWith("/api/states")) {
      return {
        status: 200,
        body: JSON.stringify([
          { entity_id: "light.a", state: "on", attributes: { friendly_name: "Light A" } },
          { entity_id: "sensor.power", state: "450", attributes: { unit_of_measurement: "W", device_class: "power" } },
        ]),
      };
    }
    return { status: 404, body: "{}" };
  };
  const cfg = { localUrl: "http://ha.local:8123", token: "tok", enabledIds: ["light.a"] };

  const svcRes = await tryDirectMethod(
    METHOD.CALL_SERVICE,
    { domain: "light", service: "turn_on", entity_id: "light.a", data: { brightness_pct: 80 } },
    cfg
  );
  assert.deepEqual(svcRes, { ok: true });

  const entities = await tryDirectMethod(METHOD.GET_ENTITIES, {}, cfg);
  assert.equal(entities.length, 1);
  assert.equal(entities[0].entity_id, "light.a");

  const energy = await tryDirectMethod(METHOD.GET_ENERGY, {}, cfg);
  assert.equal(energy.length, 1);
  assert.equal(energy[0].entity_id, "sensor.power");
});

test("directSyncSensors supports zepp2hass webhook and REST sensor modes directly over Wi-Fi", async () => {
  const calls = [];
  globalThis.fetch = async (opts) => {
    calls.push(opts);
    return { status: 200, body: JSON.stringify({ status: "ok" }) };
  };

  const z2hCfg = { sensorMode: "zepp2hass", zepp2hassUrl: "http://ha.local:8123/api/webhook/zepp", syncInterval: 10 };
  const res1 = await tryDirectMethod(METHOD.SYNC_SENSORS, { payload: { battery: { current: 90 } } }, z2hCfg);
  assert.deepEqual(res1, { interval: 10 });
  assert.equal(calls[0].url, "http://ha.local:8123/api/webhook/zepp");

  const restCfg = {
    localUrl: "http://ha.local:8123",
    token: "tok",
    sensorMode: "rest",
    syncInterval: 7,
  };
  const res2 = await tryDirectMethod(
    METHOD.SYNC_SENSORS,
    { payload: { device: { deviceName: "Balance" }, battery: { current: 85 } } },
    restCfg
  );
  assert.deepEqual(res2, { interval: 7 });
  assert.ok(calls.some((c) => c.url.endsWith("/api/states/sensor.balance_battery")));
});

test("requestOrDirect uses watch Wi-Fi first when configured and falls back to BLE on failure", async () => {
  saveDirectConfig({ localUrl: "http://ha.local:8123", token: "tok" });
  let wifiShouldFail = false;
  globalThis.fetch = async (opts) => {
    if (wifiShouldFail) throw new Error("Wi-Fi dropped");
    return { status: 200, body: JSON.stringify({ entity_id: "switch.fan", state: "on", attributes: { friendly_name: "Fan" } }) };
  };

  const bleRequests = [];
  const requester = {
    request: async (req) => {
      bleRequests.push(req);
      if (req.method === METHOD.GET_CONFIG) {
        return { favorites: ["switch.fan"], localUrl: "http://ha.local:8123", token: "tok2" };
      }
      return { entity_id: "switch.fan", state: "off", name: "Fan (BLE)" };
    },
  };

  // 1. Direct Wi-Fi succeeds -> BLE is NOT called
  const entWifi = await requestOrDirect(requester, { method: METHOD.GET_ENTITY, params: { entity_id: "switch.fan" } });
  assert.equal(entWifi.name, "Fan");
  assert.equal(entWifi.state, "on");
  assert.equal(bleRequests.length, 0);

  // 2. Wi-Fi fails -> transparently falls back to BLE
  wifiShouldFail = true;
  const entBle = await requestOrDirect(requester, { method: METHOD.GET_ENTITY, params: { entity_id: "switch.fan" } });
  assert.equal(entBle.name, "Fan (BLE)");
  assert.equal(bleRequests.length, 1);

  // 3. GET_CONFIG saves returned config to localStorage
  await requestOrDirect(requester, { method: METHOD.GET_CONFIG, params: {} });
  assert.equal(loadDirectConfig().token, "tok2");
});

test("directFetch and error branches throw expected errors", async () => {
  globalThis.fetch = async () => ({ status: 0 });
  await assert.rejects(() => directFetch("http://ha.local/api"), /No response/);

  globalThis.fetch = async () => ({ status: 401, body: "Unauthorized" });
  await assert.rejects(() => directFetch("http://ha.local/api"), /HTTP 401/);

  await assert.rejects(() => directHaRequest("/api/states", {}, {}), /Direct HA credentials not available/);
  await assert.rejects(() => directSyncSensors(null, {}), /No sensor payload/);
  assert.deepEqual(await directSyncSensors({}, { sensorMode: "none" }), { disabled: true });
});
