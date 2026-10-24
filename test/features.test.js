import { test } from "node:test";
import assert from "node:assert/strict";
import { MEDIA_FEATURE, hasFeature, supportsBrightness } from "../utils/features.js";

test("supportsBrightness is true for any mode except onoff", () => {
  assert.equal(supportsBrightness(["onoff"]), false);
  assert.equal(supportsBrightness([]), false);
  assert.equal(supportsBrightness(undefined), false);
  assert.equal(supportsBrightness(["brightness"]), true);
  assert.equal(supportsBrightness(["onoff", "color_temp"]), true);
  assert.equal(supportsBrightness(["rgb"]), true);
});

test("hasFeature checks one supported_features bit", () => {
  const supported = MEDIA_FEATURE.PAUSE | MEDIA_FEATURE.NEXT_TRACK;
  assert.equal(hasFeature(supported, MEDIA_FEATURE.PAUSE), true);
  assert.equal(hasFeature(supported, MEDIA_FEATURE.NEXT_TRACK), true);
  assert.equal(hasFeature(supported, MEDIA_FEATURE.PREVIOUS_TRACK), false);
  assert.equal(hasFeature(undefined, MEDIA_FEATURE.PAUSE), false);
});
