import { test } from "node:test";
import assert from "node:assert";
import {
  COVER_FEATURE, supportsFeature, pickHvacModes, rowX, alarmPolicy, createConfirmTap, debounce, wait,
} from "../utils/controls.js";

test("cover feature bits", () => {
  assert.equal(supportsFeature(15, COVER_FEATURE.OPEN), true);
  assert.equal(supportsFeature(15, COVER_FEATURE.SET_POSITION), true);
  assert.equal(supportsFeature(1 | 2, COVER_FEATURE.STOP), false);
  assert.equal(supportsFeature(undefined, COVER_FEATURE.CLOSE), false);
});

test("hvac modes: common ones first, at most four, current kept visible", () => {
  assert.deepEqual(pickHvacModes(["dry", "heat", "off", "auto", "cool"]), ["off", "heat", "cool", "auto"]);
  assert.deepEqual(pickHvacModes(["dry", "heat"], "heat"), ["heat", "dry"]);
  assert.deepEqual(pickHvacModes(undefined, "off"), []);
  assert.deepEqual(pickHvacModes(["off", "heat", "cool", "auto", "dry", "fan_only"], "dry"), ["off", "heat", "cool", "dry"]);
});

test("button rows are centred", () => {
  assert.deepEqual(rowX(2, 160, 16), [72, 248]);
  assert.deepEqual(rowX(1, 100), [190]);
});

test("alarm code policy", () => {
  assert.deepEqual(alarmPolicy({}), { needsCode: false, canArm: true, canDisarm: true });
  assert.deepEqual(alarmPolicy({ code_format: "number", code_arm_required: true }),
    { needsCode: true, canArm: false, canDisarm: false });
  assert.deepEqual(alarmPolicy({ code_format: "number", code_arm_required: false }),
    { needsCode: true, canArm: true, canDisarm: false });
});

test("confirm tap: first arms, second within window confirms", () => {
  const t = createConfirmTap(3000);
  assert.equal(t.tap(0), false);
  assert.equal(t.tap(1000), true);
  assert.equal(t.tap(2000), false);
  assert.equal(t.tap(6000), false, "window expired, arms again");
  assert.equal(t.tap(6500), true);
});

test("debounce runs once with the last arguments", async () => {
  const calls = [];
  const d = debounce((v) => calls.push(v), 20);
  d(1); d(2); d(3);
  await wait(60);
  assert.deepEqual(calls, [3]);
});

test("debounce cancel drops the pending call", async () => {
  const calls = [];
  const d = debounce((v) => calls.push(v), 20);
  d(1);
  d.cancel();
  await wait(60);
  assert.deepEqual(calls, []);
});
