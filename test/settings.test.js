// Phone settings page (setting/index.js) driven through fake components, and its pure helpers (setting/logic.js).
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { load } from "./helpers/watch.js";
import { installSettings } from "./helpers/phone.js";
import { SETTING } from "../shared/protocol.js";
import * as logic from "../setting/logic.js";

const RED = "#d32f2f";
const ENTITIES = [
  { key: "light.a", title: "A", value: true },
  { key: "climate.x", title: "X", value: false },
  { key: "foo.bar", title: "Foo", value: true }, // unsupported domain, never listed
  { key: "sensor.s", title: "S", value: false },
];

let store;
let props;
let page;

// Components return plain objects: { type, props, children }.
function installComponents() {
  for (const type of ["View", "Text", "Button", "Toggle", "Section", "TextInput", "Select"]) {
    globalThis[type] = (props = {}, children) => ({ type, props, children });
  }
}

function nodes(tree) {
  const out = [];
  const walk = (n) => {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) return n.forEach(walk);
    if (n.type) out.push(n);
    walk(n.children);
  };
  walk(tree);
  return out;
}

const texts = (tree) => nodes(tree).filter((n) => n.type === "Text" || n.type === "Section").map((n) => n.children);
const ofType = (tree, type) => nodes(tree).filter((n) => n.type === type);
function one(tree, type, label) {
  const found = ofType(tree, type).filter((n) => n.props.label === label);
  assert.equal(found.length, 1, `${type} "${label}" count`);
  return found[0];
}
const toggles = (tree, label) => ofType(tree, "Toggle").filter((n) => n.props.label === label);
const favToggles = (tree) => ofType(tree, "Toggle").filter((n) => n.props.label.startsWith("★"));
const topButtons = (tree) => ofType(tree, "Button").filter((n) => n.props.label === "Top");
const entityList = () => JSON.parse(store.get(SETTING.ENTITY_LIST));
const build = () => page.build(props);

async function open(initial = {}) {
  store = installSettings(initial);
  props = { settingsStorage: globalThis.settings.settingsStorage };
  page = await load("setting/index.js", "settingsPage");
  return build();
}

beforeEach(() => installComponents());

test("connection: URLs stored as typed, token trimmed", async () => {
  let tree = await open();
  one(tree, "TextInput", "IPLocal").props.onChange("http://ha.local:8123");
  one(tree, "TextInput", "IPExternal").props.onChange("https://ha.example.com");
  one(tree, "TextInput", "LongToken").props.onChange("  tok  ");
  assert.equal(store.get(SETTING.LOCAL_URL), "http://ha.local:8123");
  assert.equal(store.get(SETTING.EXTERNAL_URL), "https://ha.example.com");
  assert.equal(store.get(SETTING.TOKEN), "tok");
  tree = build();
  assert.equal(one(tree, "TextInput", "IPLocal").props.value, "http://ha.local:8123");
});

test("refresh button writes a timestamp to the refresh key", async () => {
  const tree = await open();
  const before = Date.now();
  one(tree, "Button", "Refresh entities").props.onClick();
  const after = Date.now();
  const stamp = store.get(SETTING.REFRESH_ENTITIES);
  assert.match(stamp, /^\d+$/);
  assert.ok(Number(stamp) >= before && Number(stamp) <= after);
});

test("status message shown under the buttons, red when it failed", async () => {
  let tree = await open({ [SETTING.STATUS]: JSON.stringify({ ok: true, message: "3 entities", time: 1 }) });
  let node = nodes(tree).find((n) => n.children === "3 entities");
  assert.ok(node);
  assert.notEqual(node.props.style.color, RED);

  store.set(SETTING.STATUS, JSON.stringify({ ok: false, message: "HA down", time: 2 }));
  tree = build();
  node = nodes(tree).find((n) => n.children === "HA down");
  assert.equal(node.props.style.color, RED);
});

test("no status message when none was written", async () => {
  const tree = await open();
  assert.equal(texts(tree).filter((t) => t === "HA down" || t === "3 entities").length, 0);
});

test("entity list: supported domains only, search filters by id", async () => {
  let tree = await open({ [SETTING.ENTITY_LIST]: JSON.stringify(ENTITIES) });
  const labels = ofType(tree, "Toggle").map((n) => n.props.label).filter((l) => !l.startsWith("★"));
  assert.deepEqual(labels, ["A (light.a)", "X (climate.x)", "S (sensor.s)"]);

  one(tree, "TextInput", "Filter").props.onChange("climate");
  assert.equal(store.get("filter"), "climate");
  tree = build();
  const filtered = ofType(tree, "Toggle").map((n) => n.props.label).filter((l) => !l.startsWith("★"));
  assert.deepEqual(filtered, ["X (climate.x)"]);
});

test("empty list and no-match hints", async () => {
  let tree = await open();
  assert.ok(texts(tree).includes("Tap Refresh entities to load them from Home Assistant."));

  store.set(SETTING.ENTITY_LIST, JSON.stringify(ENTITIES));
  store.set("filter", "nothing-like-this");
  tree = build();
  assert.ok(texts(tree).includes("No entity matches the filter."));
});

test("a corrupt entity list shows as empty", async () => {
  const tree = await open({ [SETTING.ENTITY_LIST]: "{not json" });
  assert.ok(texts(tree).includes("Tap Refresh entities to load them from Home Assistant."));
});

test("show-on-watch toggle saves the flag", async () => {
  let tree = await open({ [SETTING.ENTITY_LIST]: JSON.stringify(ENTITIES) });
  toggles(tree, "A (light.a)")[0].props.onChange(false);
  assert.equal(entityList().find((e) => e.key === "light.a").value, false);
  tree = build();
  assert.equal(toggles(tree, "X (climate.x)")[0].props.value, false);
  toggles(tree, "X (climate.x)")[0].props.onChange(true);
  assert.equal(entityList().find((e) => e.key === "climate.x").value, true);
});

test("favorites keep the order they were marked in; unmarking removes", async () => {
  let tree = await open({ [SETTING.ENTITY_LIST]: JSON.stringify(ENTITIES) });
  const fav = () => JSON.parse(store.get(SETTING.FAVORITES));

  favToggles(tree)[1].props.onChange(true); // climate.x
  tree = build();
  favToggles(tree)[0].props.onChange(true); // light.a
  assert.deepEqual(fav(), ["climate.x", "light.a"]);

  tree = build();
  assert.equal(favToggles(tree)[0].props.value, true);
  favToggles(tree)[0].props.onChange(false); // light.a unmarked
  assert.deepEqual(fav(), ["climate.x"]);
  favToggles(build())[1].props.onChange(true); // climate.x again: already marked, no change
  assert.deepEqual(fav(), ["climate.x"]);
});

test("Top moves the entity to the front and keeps the flags", async () => {
  const tree = await open({ [SETTING.ENTITY_LIST]: JSON.stringify(ENTITIES) });
  topButtons(tree)[1].props.onClick(); // climate.x
  assert.deepEqual(
    entityList().map((e) => e.key),
    ["climate.x", "light.a", "foo.bar", "sensor.s"]
  );
  assert.equal(entityList()[0].value, false);
});

test("Health data: default mode is off, no sync or URL fields", async () => {
  const tree = await open();
  const mode = one(tree, "Select", "Send health data to");
  assert.equal(mode.props.value, "none");
  assert.deepEqual(
    mode.props.options.map((o) => o.value),
    ["none", "zepp2hass", "mobile_app", "rest"]
  );
  assert.equal(ofType(tree, "Select").length, 1);
  assert.equal(ofType(tree, "TextInput").some((n) => n.props.label === "zepp2hass webhook URL"), false);
});

test("choosing a mode saves it; an interval select appears for any mode but off", async () => {
  let tree = await open();
  one(tree, "Select", "Send health data to").props.onChange("rest");
  assert.equal(store.get(SETTING.SENSOR_MODE), "rest");

  tree = build();
  const interval = one(tree, "Select", "Sync every");
  assert.equal(interval.props.value, "5");
  assert.deepEqual(
    interval.props.options.map((o) => o.value),
    ["1", "5", "10", "15", "30", "60"]
  );
  interval.props.onChange("30");
  assert.equal(store.get(SETTING.SYNC_INTERVAL), "30");
});

test("zepp2hass: URL must start with http:// or https://", async () => {
  await open({ [SETTING.SENSOR_MODE]: "zepp2hass" });
  const url = () => one(build(), "TextInput", "zepp2hass webhook URL");
  const err = "Must start with http:// or https://";

  url().props.onChange("ftp://nope");
  assert.equal(store.get(SETTING.ZEPP2HASS_URL), undefined);
  assert.ok(texts(build()).includes(err));

  url().props.onChange("https://");
  assert.equal(store.get(SETTING.ZEPP2HASS_URL), undefined);

  url().props.onChange("  https://z.example/hook  ");
  assert.equal(store.get(SETTING.ZEPP2HASS_URL), "https://z.example/hook");
  assert.equal(texts(build()).includes(err), false);
});

test("mobile_app: register button and registration state", async () => {
  let tree = await open({ [SETTING.SENSOR_MODE]: "mobile_app" });
  assert.ok(texts(tree).includes("Not registered yet"));

  const before = Date.now();
  one(tree, "Button", "Register in Home Assistant").props.onClick();
  assert.match(store.get(SETTING.REGISTER_REQUEST), /^\d+$/);
  assert.ok(Number(store.get(SETTING.REGISTER_REQUEST)) >= before);

  store.set(SETTING.MOBILE_APP, JSON.stringify({ device_id: "d", webhook_id: "w" }));
  tree = build();
  assert.ok(texts(tree).includes("Registered in Home Assistant"));
});

test("mobile_app: register result shows under the button", async () => {
  const tree = await open({
    [SETTING.SENSOR_MODE]: "mobile_app",
    [SETTING.STATUS]: JSON.stringify({ ok: false, message: "Unexpected response from Home Assistant", time: 1 }),
  });
  const node = nodes(tree).find((n) => n.children === "Unexpected response from Home Assistant");
  assert.equal(node.props.style.color, RED);
});

test("last sync: none, ok, and failed", async () => {
  let tree = await open({ [SETTING.SENSOR_MODE]: "rest" });
  assert.ok(texts(tree).includes("No sync yet"));

  store.set(SETTING.LAST_SYNC, JSON.stringify({ time: 1700000000000, ok: true }));
  tree = build();
  const ok = texts(tree).find((t) => t.startsWith("Last sync: "));
  assert.ok(ok);
  assert.notEqual(nodes(tree).find((n) => n.children === ok).props.style.color, RED);

  store.set(SETTING.LAST_SYNC, JSON.stringify({ time: 1700000000000, ok: false, error: "HTTP 500" }));
  tree = build();
  const failed = nodes(tree).find((n) => n.children === "Last sync failed: HTTP 500");
  assert.equal(failed.props.style.color, RED);
});

test("Sleep as Android: notify service is normalised, invalid input is not saved", async () => {
  let tree = await open({ [SETTING.SAA_NOTIFY_SERVICE]: "mobile_app_old" });
  const notify = () => one(build(), "TextInput", "Notify service");
  const err = "Letters, digits and _ only, e.g. mobile_app_pixel_8";

  notify().props.onChange("  notify.mobile_app_pixel_8 ");
  assert.equal(store.get(SETTING.SAA_NOTIFY_SERVICE), "mobile_app_pixel_8");

  notify().props.onChange("Bad Name!");
  assert.equal(store.get(SETTING.SAA_NOTIFY_SERVICE), "mobile_app_pixel_8");
  assert.ok(texts(build()).includes(err));

  notify().props.onChange("");
  assert.equal(store.get(SETTING.SAA_NOTIFY_SERVICE), "");
  assert.equal(texts(build()).includes(err), false);
});

test("Sleep as Android: status entity must be an entity id or empty", async () => {
  await open();
  const status = () => one(build(), "TextInput", "Status entity");
  const err = "Entity id like sensor.sleep_as_android, or empty";

  status().props.onChange("sleep");
  assert.equal(store.get(SETTING.SAA_STATUS_ENTITY), undefined);
  assert.ok(texts(build()).includes(err));

  status().props.onChange("sensor.sleep_as_android");
  assert.equal(store.get(SETTING.SAA_STATUS_ENTITY), "sensor.sleep_as_android");
  assert.equal(texts(build()).includes(err), false);

  status().props.onChange("   ");
  assert.equal(store.get(SETTING.SAA_STATUS_ENTITY), "");
});

// ---- setting/logic.js ----

test("isHttpUrl accepts http and https with something after the scheme", () => {
  assert.equal(logic.isHttpUrl("http://a"), true);
  assert.equal(logic.isHttpUrl("https://a.b/c"), true);
  assert.equal(logic.isHttpUrl("https://"), false);
  assert.equal(logic.isHttpUrl("ws://a"), false);
  assert.equal(logic.isHttpUrl(""), false);
});

test("normalizeNotifyService strips notify., trims, clears on empty, rejects bad names", () => {
  assert.equal(logic.normalizeNotifyService(" notify.mobile_app_x "), "mobile_app_x");
  assert.equal(logic.normalizeNotifyService("mobile_app_x"), "mobile_app_x");
  assert.equal(logic.normalizeNotifyService("notify."), "");
  assert.equal(logic.normalizeNotifyService("  "), "");
  assert.equal(logic.normalizeNotifyService("Mobile-App"), null);
  assert.equal(logic.normalizeNotifyService("a.b"), null);
});

test("normalizeStatusEntity accepts entity ids and empty, rejects the rest", () => {
  assert.equal(logic.normalizeStatusEntity(" sensor.x_1 "), "sensor.x_1");
  assert.equal(logic.normalizeStatusEntity(""), "");
  assert.equal(logic.normalizeStatusEntity("sensor"), null);
  assert.equal(logic.normalizeStatusEntity("Sensor.X"), null);
});

test("parseJson, readList and readEntities tolerate bad input", () => {
  assert.deepEqual(logic.parseJson("[1]", null), [1]);
  assert.equal(logic.parseJson("nope", "fallback"), "fallback");
  assert.equal(logic.parseJson("null", "fallback"), "fallback");
  assert.equal(logic.parseJson(undefined, 7), 7);
  assert.deepEqual(logic.readList('{"a":1}'), []);
  assert.deepEqual(logic.readList(""), []);
  assert.deepEqual(logic.readEntities(JSON.stringify([null, { key: 1 }, { key: "light.a", title: "A", value: true }])), [
    { key: "light.a", title: "A", value: true },
  ]);
});

test("visibleEntities keeps supported domains containing the text", () => {
  const list = [{ key: "light.a" }, { key: "foo.a" }, { key: "light.b" }, { key: "constructor.x" }];
  assert.deepEqual(logic.visibleEntities(list, undefined).map((e) => e.key), ["light.a", "light.b"]);
  assert.deepEqual(logic.visibleEntities(list, "b").map((e) => e.key), ["light.b"]);
});

test("setEnabled changes one flag and leaves the rest", () => {
  const list = [{ key: "a.a", value: false }, { key: "b.b", value: true }];
  assert.deepEqual(logic.setEnabled(list, "a.a", true), [
    { key: "a.a", value: true },
    { key: "b.b", value: true },
  ]);
  assert.equal(list[0].value, false);
});

test("setFavorite appends new ids, keeps existing order, removes on off", () => {
  assert.deepEqual(logic.setFavorite(["a"], "b", true), ["a", "b"]);
  assert.deepEqual(logic.setFavorite(["a", "b"], "a", true), ["a", "b"]);
  assert.deepEqual(logic.setFavorite(["a", "b"], "a", false), ["b"]);
  assert.deepEqual(logic.setFavorite(["a"], "z", false), ["a"]);
});

test("moveToTop moves one key to the front, unknown or first key changes nothing", () => {
  const list = [{ key: "a" }, { key: "b" }, { key: "c" }];
  assert.deepEqual(logic.moveToTop(list, "c").map((e) => e.key), ["c", "a", "b"]);
  assert.deepEqual(logic.moveToTop(list, "a").map((e) => e.key), ["a", "b", "c"]);
  assert.deepEqual(logic.moveToTop(list, "zzz").map((e) => e.key), ["a", "b", "c"]);
  assert.notEqual(logic.moveToTop(list, "a"), list);
});
