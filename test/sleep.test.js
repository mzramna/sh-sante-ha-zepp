import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { state, reset, respond, open, texts, findText, click, sleep } from "./helpers/watch.js";
import { installSettings, installFetch } from "./helpers/phone.js";
import * as ha from "../app-side/ha.js";
import { SAA_ACTIONS, saaCommand } from "../utils/sleep.js";

const PAGE = "page/sleep/index.js";
const START = "com.urbandroid.sleep.alarmclock.START_SLEEP_TRACK";
const STOP = "com.urbandroid.sleep.alarmclock.STOP_SLEEP_TRACK";
const CONFIGURED = { saaNotifyService: "mobile_app_pixel_8", saaStatusEntity: "input_boolean.sleep_as_android" };
const entity = { entity_id: "input_boolean.sleep_as_android", domain: "input_boolean", name: "Sleep tracking", state: "on", unit: "", area: "", attributes: {} };
const commandParams = (action) => ({ domain: "notify", service: "mobile_app_pixel_8", data: saaCommand(action) });

let pages = [];
beforeEach(() => {
  reset();
  pages = [];
  state.strings = { state_on: "On", state_off: "Off" };
});

// Opens the page and remembers it so the tests can destroy it (stops pending refreshes).
async function openPage(config = CONFIGURED, get = entity) {
  respond({ GET_CONFIG: config, GET_ENTITY: get, CALL_SERVICE: { ok: true } });
  const page = await open(PAGE);
  pages.push(page);
  return page;
}

test("without a notify service the page only explains how to set it", async () => {
  await openPage({ saaNotifyService: "", saaStatusEntity: "input_boolean.x" });
  assert.ok(texts().includes("saa_not_configured"), texts().join("|"));
  assert.equal(findText("start_tracking"), undefined);
  assert.equal(findText("stop_tracking"), undefined);
  assert.deepEqual(state.requests.map((r) => r.method), ["GET_CONFIG"]);
});

test("status line shows the status entity state", async () => {
  await openPage();
  assert.ok(texts().includes("Sleep tracking"), texts().join("|"));
  assert.ok(texts().includes("On"), texts().join("|"));
  const req = state.requests.find((r) => r.method === "GET_ENTITY");
  assert.deepEqual(req.params, { entity_id: "input_boolean.sleep_as_android" });
});

test("no status entity: no status request and no status card", async () => {
  await openPage({ saaNotifyService: "mobile_app_pixel_8", saaStatusEntity: "" });
  assert.equal(state.requests.some((r) => r.method === "GET_ENTITY"), false);
  assert.ok(findText("start_tracking"));
  assert.equal(findText("On"), undefined);
});

test("status request error is shown and the buttons still work", async () => {
  await openPage(CONFIGURED, new Error("Entity not found: input_boolean.sleep_as_android"));
  assert.ok(findText("Entity not found"), texts().join("|"));
  assert.ok(findText("start_tracking"));
});

test("start sends the exact CALL_SERVICE params and toasts done", async () => {
  const page = await openPage();
  const before = state.requests.length;
  await click(findText("start_tracking"));
  const sent = state.requests.slice(before);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].method, "CALL_SERVICE");
  assert.deepEqual(sent[0].params, commandParams(SAA_ACTIONS.START));
  assert.equal(sent[0].params.data.data.intent_action, START);
  assert.deepEqual(state.toasts, ["done"]);
  page.onDestroy();
});

test("after a start the status is refreshed about 2 s later", async () => {
  const page = await openPage();
  await click(findText("start_tracking"));
  const gets = () => state.requests.filter((r) => r.method === "GET_ENTITY").length;
  assert.equal(gets(), 1);
  await sleep(2100);
  assert.equal(gets(), 2);
  page.onDestroy();
});

test("stop needs two taps: the first only asks for confirmation", async () => {
  const page = await openPage();
  const before = state.requests.length;
  await click(findText("stop_tracking"));
  assert.equal(state.requests.slice(before).some((r) => r.method === "CALL_SERVICE"), false);
  assert.ok(findText("tap_again_to_confirm"), texts().join("|"));
  await click(findText("tap_again_to_confirm"));
  const sent = state.requests.filter((r) => r.method === "CALL_SERVICE");
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].params, commandParams(SAA_ACTIONS.STOP));
  assert.equal(sent[0].params.data.data.intent_action, STOP);
  page.onDestroy();
});

test("a failed command toasts the error and does not refresh", async () => {
  const page = await openPage();
  respond({ GET_CONFIG: CONFIGURED, GET_ENTITY: entity, CALL_SERVICE: new Error("No response from https://h") });
  const before = state.requests.length;
  await click(findText("start_tracking"));
  assert.ok(state.toasts.some((t) => t.includes("No response from https://h")), state.toasts.join("|"));
  assert.equal(state.requests.slice(before).some((r) => r.method === "GET_ENTITY"), false);
  page.onDestroy();
});

test("saaCommand builds the notify command data for each action", () => {
  assert.deepEqual(saaCommand("start"), {
    message: "command_broadcast_intent",
    data: { intent_package_name: "com.urbandroid.sleep", intent_action: START },
  });
  assert.equal(saaCommand(SAA_ACTIONS.STOP).data.intent_action, STOP);
  assert.throws(() => saaCommand("snooze"), /Unknown Sleep as Android action: snooze/);
  assert.throws(() => saaCommand("constructor"), /Unknown/);
});

test("callService to notify posts the command without entity_id", async () => {
  installSettings({ localHAIP: "https://h", HAToken: "t" });
  const calls = installFetch([["https://h/api/services/notify/mobile_app_pixel_8", { status: 200, body: "[]" }]]);

  const res = await ha.callService({
    domain: "notify",
    service: "mobile_app_pixel_8",
    entity_id: undefined,
    data: saaCommand(SAA_ACTIONS.START),
  });

  assert.deepEqual(res, { ok: true });
  assert.equal(calls[0].url, "https://h/api/services/notify/mobile_app_pixel_8");
  assert.equal(calls[0].method, "POST");
  const body = JSON.parse(calls[0].body);
  assert.equal("entity_id" in body, false);
  assert.deepEqual(body, saaCommand(SAA_ACTIONS.START));
});
