import { test } from "node:test";
import assert from "node:assert/strict";
import { state, reset, respond, open, texts } from "./helpers/watch.js";

test("harness renders the areas page from mocked phone data", async () => {
  reset();
  respond({ GET_AREAS: [{ area_id: "kitchen", name: "Kitchen", entity_ids: ["light.a"] }] });
  await open("page/areas/index.js");
  assert.ok(texts().some((t) => t.includes("Kitchen")), texts().join("|"));
  assert.equal(state.requests[0].method, "GET_AREAS");
});
