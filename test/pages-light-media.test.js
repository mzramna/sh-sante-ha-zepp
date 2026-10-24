import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { state, reset, respond, texts, findText, click, flush, sleep } from "./helpers/watch.js";
import { COLOR, CX, DOMAINS } from "../utils/theme.js";

// Each page module is imported once per file (so coverage counts it). A test opens a shallow copy
// of the definition with a fresh state, and every page a test opens is destroyed afterwards,
// so its timers never leak into the next test.
const definitions = new Map();
const opened = [];
async function openPage(path, params) {
  if (!definitions.has(path)) {
    await import(new URL(`../${path}`, import.meta.url).href);
    definitions.set(path, globalThis.__zepp.page);
  }
  const pristine = definitions.get(path);
  const page = { ...pristine, state: structuredClone(pristine.state || {}) };
  page.onInit?.(params === undefined ? undefined : JSON.stringify(params));
  page.build?.();
  await flush();
  opened.push(page);
  return page;
}
afterEach(() => {
  for (const page of opened.splice(0)) page.onDestroy?.();
});

const MINUS = "−";
const button = (text) => {
  const w = state.widgets.find((x) => x.type === "BUTTON" && x.props.text === text);
  if (!w) throw new Error(`no button "${text}"`);
  return w;
};
// Transport/power buttons only; the volume or brightness ring's +/- are not listed.
const buttons = () =>
  state.widgets.filter((w) => w.type === "BUTTON" && w.props.text !== "+" && w.props.text !== MINUS).map((w) => w.props.text);
const sent = (method) => state.requests.filter((r) => r.method === method);
// What the page hands to this.call(): the ZML call channel keeps only the first argument.
const callChannel = () => state.calls;
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
};

// ---------- light ----------

const LIGHT_ID = "light.kitchen";
const LIGHT = {
  entity_id: LIGHT_ID, name: "Kitchen", state: "on",
  attributes: { brightness_pct: 50, supported_color_modes: ["brightness"], effect: "rainbow", effect_list: ["rainbow", "pulse", "candle"] },
};
const lightPage = (entity = LIGHT, extra = {}) => {
  respond({ GET_ENTITY: entity, CALL_SERVICE: { ok: true }, ...extra });
  return openPage("page/light/index.js", { entity_id: LIGHT_ID });
};

test("light: a failed entity load shows the error and no controls", async () => {
  reset();
  respond({ GET_ENTITY: new Error("offline") });
  await openPage("page/light/index.js", { entity_id: LIGHT_ID });
  assert.deepEqual(texts(), ["error"]);
  assert.deepEqual(buttons(), []);
});

test("light: typical attributes draw title, power, effect and brightness ring", async () => {
  reset();
  await lightPage();
  assert.ok(findText("Kitchen"));
  assert.equal(button("on").props.normal_color, DOMAINS.light.color);
  assert.equal(button("on").props.x, CX - 170);
  assert.equal(button("rainbow").props.x, CX + 10);
  assert.ok(findText("50%"));
});

test("light: power button hands light.toggle to the call channel", async () => {
  reset();
  await lightPage();
  await click(button("on"));
  assert.deepEqual(callChannel(), ["toggle"]);
});

test("bug: power button does not send CALL_SERVICE light.toggle", {
  todo: "bug: light page's call() is replaced by ZML's messaging call(), so controls never send CALL_SERVICE (phone has no onCall handler either)",
}, async () => {
  reset();
  await lightPage();
  await click(button("on"));
  assert.deepEqual(sent("CALL_SERVICE").map((r) => r.params), [
    { domain: "light", service: "toggle", entity_id: LIGHT_ID, data: {} },
  ]);
});

test("light: an off light has a grey power button, centred, and no effect or ring", async () => {
  reset();
  await lightPage({ ...LIGHT, state: "off", attributes: { supported_color_modes: ["onoff"] } });
  assert.equal(button("off").props.normal_color, COLOR.card);
  assert.equal(button("off").props.x, CX - 80);
  assert.deepEqual(buttons(), ["off"]);
});

test("light: brightness ring sends one change after the debounce, none before", async () => {
  reset();
  await lightPage();
  await click(button("+"));
  await click(button("+"));
  await click(button(MINUS));
  await sleep(300);
  assert.equal(callChannel().length, 0, "nothing before the debounce");
  await sleep(500);
  assert.equal(callChannel().length, 1, "one send for the final value");
});

test("bug: brightness ring sends brightness_pct in CALL_SERVICE turn_on", {
  todo: "bug: brightness value is lost: this.call('turn_on', {brightness_pct}) only forwards 'turn_on' to the call channel",
}, async () => {
  reset();
  await lightPage();
  await click(button("+"));
  await click(button("+"));
  await click(button(MINUS));
  await sleep(800);
  assert.deepEqual(sent("CALL_SERVICE").map((r) => r.params), [
    { domain: "light", service: "turn_on", entity_id: LIGHT_ID, data: { brightness_pct: 60 } },
  ]);
});

test("light: an entity reload does not redraw the brightness ring while it is being turned", async () => {
  reset();
  const page = await lightPage();
  await click(button("+"));
  assert.ok(findText("60%"));
  page.load();
  await flush();
  assert.ok(findText("60%"), "the ring keeps the value the user is setting");
  assert.equal(findText("50%"), undefined);
  await sleep(700);
  assert.equal(callChannel().length, 1);
});

test("light: destroying the page drops a pending brightness change", async () => {
  reset();
  const page = await lightPage();
  await click(button("+"));
  page.onDestroy();
  await sleep(700);
  assert.equal(callChannel().length, 0);
});

test("light: onResume reloads the entity once it has been loaded", async () => {
  reset();
  const page = await lightPage();
  const before = sent("GET_ENTITY").length;
  page.onResume();
  await flush();
  assert.equal(sent("GET_ENTITY").length, before + 1);
});

test("light: onResume does nothing when the first load failed", async () => {
  reset();
  respond({ GET_ENTITY: new Error("offline") });
  const page = await openPage("page/light/index.js", { entity_id: LIGHT_ID });
  page.onResume();
  await flush();
  assert.equal(sent("GET_ENTITY").length, 1);
});

test("bug: a successful command reloads the entity 1 s later", {
  todo: "bug: light page never reloads after a command, because call() is replaced and its refresh timer is never set",
}, async () => {
  reset();
  await lightPage();
  await click(button("on"));
  await sleep(1100);
  assert.equal(sent("GET_ENTITY").length, 2);
});

test("bug: a failed command shows an error toast", {
  todo: "bug: light page never reports a failed command, because call() is replaced and its error toast is unreachable",
}, async () => {
  reset();
  await lightPage(LIGHT, { CALL_SERVICE: new Error("boom") });
  await click(button("on"));
  assert.deepEqual(state.toasts, ["error"]);
});

test("bug: an entity reply that arrives after onDestroy still draws the page", {
  todo: "bug: light page has no alive guard, so a GET_ENTITY reply after onDestroy draws widgets on the destroyed page",
}, async () => {
  reset();
  const reply = deferred();
  respond({ GET_ENTITY: () => reply.promise });
  const page = await openPage("page/light/index.js", { entity_id: LIGHT_ID });
  page.onDestroy();
  reply.resolve(LIGHT);
  await flush();
  assert.equal(findText("Kitchen"), undefined);
});

// ---------- light effect picker ----------

const EFFECTS = {
  entity_id: LIGHT_ID, name: "Kitchen", state: "on",
  attributes: { effect: "pulse", effect_list: ["rainbow", "pulse", "candle"] },
};
const effectPage = (entity = EFFECTS, extra = {}) => {
  respond({ GET_ENTITY: entity, CALL_SERVICE: { ok: true }, ...extra });
  return openPage("page/light/effect.js", { entity_id: LIGHT_ID });
};

test("effect picker: one row per effect with the current one highlighted", async () => {
  reset();
  await effectPage();
  assert.ok(findText("effect"));
  const cards = state.widgets.filter((w) => w.type === "FILL_RECT");
  assert.deepEqual(cards.map((w) => w.props.color), [COLOR.card, DOMAINS.light.color, COLOR.card]);
  assert.deepEqual(cards.map((w) => w.props.y), [84, 158, 232]);
  assert.equal(findText("pulse").props.color, COLOR.bg);
  assert.equal(findText("rainbow").props.color, COLOR.text);
});

test("effect picker: tapping a label applies the effect, toasts it and goes back", async () => {
  reset();
  await effectPage();
  await click(findText("candle"));
  assert.deepEqual(sent("CALL_SERVICE").map((r) => r.params), [
    { domain: "light", service: "turn_on", entity_id: LIGHT_ID, data: { effect: "candle" } },
  ]);
  assert.deepEqual(state.toasts, ["candle"]);
  assert.deepEqual(state.routes, [{ type: "back" }]);
});

test("effect picker: tapping the row background also applies the effect", async () => {
  reset();
  await effectPage();
  await click(state.widgets.find((w) => w.type === "FILL_RECT" && w.props.y === 84));
  assert.equal(sent("CALL_SERVICE")[0].params.data.effect, "rainbow");
  assert.deepEqual(state.routes, [{ type: "back" }]);
});

test("effect picker: a failed apply shows an error and stays on the page", async () => {
  reset();
  await effectPage(EFFECTS, { CALL_SERVICE: new Error("nope") });
  await click(findText("candle"));
  assert.deepEqual(state.toasts, ["error"]);
  assert.deepEqual(state.routes, []);
});

test("effect picker: a failed load shows the error", async () => {
  reset();
  await effectPage(new Error("offline"));
  assert.deepEqual(texts(), ["error"]);
});

test("effect picker: an entity without effects draws only the title", async () => {
  reset();
  await effectPage({ ...EFFECTS, attributes: {} });
  assert.deepEqual(texts(), ["effect"]);
});

// ---------- media player ----------

const MEDIA_ID = "media_player.tv";
// PAUSE | VOLUME_SET | PREVIOUS_TRACK | NEXT_TRACK | TURN_ON | TURN_OFF
const ALL_FEATURES = 1 | 4 | 16 | 32 | 128 | 256;
const PLAYER = {
  entity_id: MEDIA_ID, name: "Living TV", state: "playing",
  attributes: { media_title: "Song", media_artist: "Artist", volume_level: 0.4, supported_features: ALL_FEATURES },
};
const playerPage = (entity = PLAYER, extra = {}) => {
  respond({ GET_ENTITY: entity, CALL_SERVICE: { ok: true }, ...extra });
  return openPage("page/media_player/index.js", { entity_id: MEDIA_ID });
};
const withFeatures = (supported_features, state = "playing") => ({
  ...PLAYER, state, attributes: { ...PLAYER.attributes, supported_features },
});

test("media: a failed entity load shows the error", async () => {
  reset();
  respond({ GET_ENTITY: new Error("offline") });
  await openPage("page/media_player/index.js", { entity_id: MEDIA_ID });
  assert.deepEqual(texts(), ["error"]);
});

test("media: typical attributes draw title, track, transport buttons and volume ring", async () => {
  reset();
  await playerPage();
  assert.ok(findText("Living TV"));
  assert.ok(findText("Song"));
  assert.ok(findText("Artist"));
  assert.deepEqual(buttons(), ["prev", "pause", "next", "power"]);
  assert.equal(button("prev").props.x, 28);
  assert.equal(button("power").props.x, 352);
  assert.ok(findText("40%"));
});

test("media: the play/pause label follows the state", async () => {
  reset();
  await playerPage(withFeatures(1, "paused"));
  assert.deepEqual(buttons(), ["play"]);
  assert.equal(button("play").props.x, 190, "a single button is centred");
  assert.equal(findText("%"), undefined, "no volume ring without VOLUME_SET");
});

test("media: each button needs its supported_features bit", async () => {
  const cases = [
    [16 | 32, ["prev", "next"]],
    [1, ["play"]],
    [128, []],
    [128 | 256, ["power"]],
    [4, []],
  ];
  for (const [features, expected] of cases) {
    reset();
    await playerPage(withFeatures(features, "paused"));
    assert.deepEqual(buttons(), expected, `supported_features ${features}`);
  }
});

test("media: no volume ring without the VOLUME_SET bit or a numeric level", async () => {
  reset();
  await playerPage(withFeatures(ALL_FEATURES & ~4));
  assert.equal(findText("%"), undefined);
  reset();
  await playerPage({ ...PLAYER, attributes: { ...PLAYER.attributes, volume_level: undefined } });
  assert.equal(findText("%"), undefined);
});

test("media: transport and power buttons hand their services to the call channel", async () => {
  reset();
  await playerPage();
  await click(button("prev"));
  await click(button("pause"));
  await click(button("next"));
  await click(button("power"));
  assert.deepEqual(callChannel(), ["media_previous_track", "media_play_pause", "media_next_track", "toggle"]);
});

test("bug: transport and power buttons send CALL_SERVICE media_player services", {
  todo: "bug: media page's call() is replaced by ZML's messaging call(), so transport and power buttons never send CALL_SERVICE",
}, async () => {
  reset();
  await playerPage();
  await click(button("prev"));
  assert.deepEqual(sent("CALL_SERVICE")[0].params, {
    domain: "media_player", service: "media_previous_track", entity_id: MEDIA_ID, data: {},
  });
});

test("media: volume ring sends one change after the debounce, none before", async () => {
  reset();
  await playerPage();
  await click(button("+"));
  await click(button("+"));
  await sleep(300);
  assert.equal(callChannel().length, 0, "nothing before the debounce");
  await sleep(500);
  assert.equal(callChannel().length, 1, "one send for the final level");
});

test("bug: volume ring sends volume_set with the final level in CALL_SERVICE", {
  todo: "bug: volume level is lost: this.call('volume_set', {volume_level}) only forwards 'volume_set' to the call channel",
}, async () => {
  reset();
  await playerPage();
  await click(button("+"));
  await click(button("+"));
  await sleep(800);
  assert.deepEqual(sent("CALL_SERVICE").map((r) => r.params), [
    { domain: "media_player", service: "volume_set", entity_id: MEDIA_ID, data: { volume_level: 0.6 } },
  ]);
});

test("media: an entity reload does not redraw the volume ring while it is being turned", async () => {
  reset();
  const page = await playerPage();
  await click(button("+"));
  assert.ok(findText("50%"));
  page.load();
  await flush();
  assert.ok(findText("50%"), "the ring keeps the value the user is setting");
  await sleep(700);
  assert.equal(callChannel().length, 1);
});

test("media: polls the entity every 10 s and stops polling on destroy", async (t) => {
  reset();
  respond({ GET_ENTITY: PLAYER });
  t.mock.timers.enable({ apis: ["setInterval"] });
  const page = await openPage("page/media_player/index.js", { entity_id: MEDIA_ID });
  assert.equal(sent("GET_ENTITY").length, 1);
  t.mock.timers.tick(10000);
  await flush();
  assert.equal(sent("GET_ENTITY").length, 2);
  t.mock.timers.tick(10000);
  await flush();
  assert.equal(sent("GET_ENTITY").length, 3);
  page.onDestroy();
  t.mock.timers.tick(30000);
  await flush();
  assert.equal(sent("GET_ENTITY").length, 3);
});

test("media: destroying the page drops a pending volume change", async () => {
  reset();
  const page = await playerPage();
  await click(button("+"));
  page.onDestroy();
  await sleep(700);
  assert.equal(callChannel().length, 0);
});

test("bug: a successful command reloads the entity 1 s later", {
  todo: "bug: media page never reloads after a command, because call() is replaced and its refresh timer is never set",
}, async () => {
  reset();
  await playerPage();
  await click(button("next"));
  await sleep(1100);
  assert.equal(sent("GET_ENTITY").length, 2);
});

test("bug: a failed command shows an error toast", {
  todo: "bug: media page never reports a failed command, because call() is replaced and its error toast is unreachable",
}, async () => {
  reset();
  await playerPage(PLAYER, { CALL_SERVICE: new Error("nope") });
  await click(button("prev"));
  assert.deepEqual(state.toasts, ["error"]);
});

test("bug: an entity reply that arrives after onDestroy still draws the page", {
  todo: "bug: media page has no alive guard, so a GET_ENTITY reply (or poll) after onDestroy draws widgets on the destroyed page",
}, async () => {
  reset();
  const reply = deferred();
  respond({ GET_ENTITY: () => reply.promise });
  const page = await openPage("page/media_player/index.js", { entity_id: MEDIA_ID });
  page.onDestroy();
  reply.resolve(PLAYER);
  await flush();
  assert.equal(findText("Living TV"), undefined);
});
