import { test } from "node:test";
import assert from "node:assert/strict";
import { snapshotUrl, cameraSnapshot } from "../app-side/camera.js";

const settingsStore = { HAToken: "tok", localHAIP: "http://ha.local:8123/", externalHAIP: "" };
globalThis.settings = {
  settingsStorage: { getItem: (k) => settingsStore[k] ?? null },
};

test("snapshotUrl joins the base path and adds the size", () => {
  assert.equal(
    snapshotUrl("https://host/ha/", "camera.front_door", 400, 300),
    "https://host/ha/api/camera_proxy/camera.front_door?width=400&height=300"
  );
});

test("cameraSnapshot rejects a bad entity id before any download", async () => {
  const service = { download: () => assert.fail("must not download") };
  await assert.rejects(cameraSnapshot({ entity_id: "light.x", width: 400, height: 300 }, service), /Invalid camera entity/);
});

test("cameraSnapshot downloads with the bearer token and queues the file", async () => {
  const calls = [];
  const service = {
    download(url, opts) {
      calls.push({ url, opts });
      const task = {};
      queueMicrotask(() => task.onSuccess({ filePath: "data://download/a.jpg" }));
      return task;
    },
    sendFile(path, opts) {
      calls.push({ path, opts });
    },
  };
  const result = await cameraSnapshot({ entity_id: "camera.front", width: 400, height: 300 }, service);
  assert.equal(calls[0].url, "http://ha.local:8123/api/camera_proxy/camera.front?width=400&height=300");
  assert.equal(calls[0].opts.headers.Authorization, "Bearer tok");
  assert.equal(calls[1].path, "data://download/a.jpg");
  assert.equal(result.file, calls[1].opts.name);
});
