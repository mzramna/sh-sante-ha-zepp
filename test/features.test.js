import { test } from "node:test";
import assert from "node:assert/strict";
import { MEDIA_FEATURE, supportsBrightness } from "../utils/features.js";
import { supportsFeature } from "../utils/controls.js";

test("supportsBrightness is true for any mode except onoff", () => {
  assert.equal(supportsBrightness(["onoff"]), false);
  assert.equal(supportsBrightness([]), false);
  assert.equal(supportsBrightness(undefined), false);
  assert.equal(supportsBrightness(["brightness"]), true);
  assert.equal(supportsBrightness(["onoff", "color_temp"]), true);
  assert.equal(supportsBrightness(["rgb"]), true);
});

test("media feature bits are checked with supportsFeature", () => {
  const supported = MEDIA_FEATURE.PAUSE | MEDIA_FEATURE.NEXT_TRACK;
  assert.equal(supportsFeature(supported, MEDIA_FEATURE.PAUSE), true);
  assert.equal(supportsFeature(supported, MEDIA_FEATURE.NEXT_TRACK), true);
  assert.equal(supportsFeature(supported, MEDIA_FEATURE.PREVIOUS_TRACK), false);
  assert.equal(supportsFeature(undefined, MEDIA_FEATURE.PAUSE), false);
});
