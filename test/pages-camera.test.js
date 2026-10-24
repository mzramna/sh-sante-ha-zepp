import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { state, reset, respond, texts, findText, click, flush } from "./helpers/watch.js";
import { FEATURES } from "../config/build.js";
import { CX, TOP } from "../utils/theme.js";

// The page reads FEATURES.camera when it builds, so a test flips the flag on the real config object
// and restores it afterwards. The page module is imported once per file, so coverage counts it.
const CAMERA_ID = "camera.front";
const savedCamera = FEATURES.camera;
let definition = null;
const opened = [];

async function openCamera(params) {
  if (!definition) {
    await import(new URL("../page/camera/index.js", import.meta.url).href);
    definition = globalThis.__zepp.page;
  }
  const page = { ...definition, state: structuredClone(definition.state) };
  page.onInit(params === undefined ? undefined : JSON.stringify(params));
  page.build();
  await flush();
  opened.push(page);
  return page;
}

afterEach(() => {
  FEATURES.camera = savedCamera;
  for (const page of opened.splice(0)) page.onDestroy?.();
});

const button = (text) => {
  const w = state.widgets.find((x) => x.type === "BUTTON" && x.props.text === text);
  if (!w) throw new Error(`no button "${text}"`);
  return w;
};
const images = () => state.widgets.filter((w) => w.type === "IMG");
const snapshots = () => state.requests.filter((r) => r.method === "CAMERA_SNAPSHOT");

// Stands in for the file a transfer delivers: the page listens for "change" events on it.
function fakeFile(params, filePath) {
  const handlers = {};
  return {
    params,
    filePath,
    on: (event, cb) => (handlers[event] = cb),
    emit: (data) => handlers.change({ data }),
  };
}

const ENTITY = { entity_id: CAMERA_ID, name: "Front door" };

test("camera: with the camera feature off the page says so and asks for nothing", async () => {
  reset();
  FEATURES.camera = false;
  respond({});
  await openCamera({ entity_id: CAMERA_ID });
  assert.deepEqual(texts(), ["camera_disabled"]);
  assert.deepEqual(state.widgets.filter((w) => w.type === "BUTTON"), []);
  assert.deepEqual(state.requests, []);
});

test("camera: the disabled page also opens without parameters", async () => {
  reset();
  FEATURES.camera = false;
  respond({});
  await openCamera(undefined);
  assert.deepEqual(texts(), ["camera_disabled"]);
  assert.deepEqual(state.requests, []);
});

test("camera: enabled, the page loads the entity, titles itself and asks for a 400x300 snapshot", async () => {
  reset();
  FEATURES.camera = true;
  respond({ GET_ENTITY: ENTITY, CAMERA_SNAPSHOT: { file: "front.jpg" } });
  await openCamera({ entity_id: CAMERA_ID });
  assert.deepEqual(state.requests.map((r) => r.method), ["GET_ENTITY", "CAMERA_SNAPSHOT"]);
  assert.deepEqual(state.requests[1].params, { entity_id: CAMERA_ID, width: 400, height: 300 });
  assert.ok(findText("Front door"));
  assert.ok(findText("loading"), "waiting for the image");
  assert.ok(button("camera_refresh"));
});

test("camera: enabled, a failed entity lookup falls back to the entity id as the title", async () => {
  reset();
  FEATURES.camera = true;
  respond({ GET_ENTITY: new Error("not found"), CAMERA_SNAPSHOT: { file: "front.jpg" } });
  await openCamera({ entity_id: CAMERA_ID });
  assert.ok(findText(CAMERA_ID));
  assert.equal(snapshots().length, 1, "the snapshot is still requested");
});

test("camera: enabled, a failed snapshot request shows the error and a refresh button", async () => {
  reset();
  FEATURES.camera = true;
  respond({ GET_ENTITY: ENTITY, CAMERA_SNAPSHOT: new Error("camera offline") });
  await openCamera({ entity_id: CAMERA_ID });
  assert.ok(findText("Error: camera offline"));
  assert.ok(button("camera_refresh"));
});

test("camera: enabled, the image is shown once the transfer has finished", async () => {
  reset();
  FEATURES.camera = true;
  respond({ GET_ENTITY: ENTITY, CAMERA_SNAPSHOT: { file: "front.jpg" } });
  const page = await openCamera({ entity_id: CAMERA_ID });
  const file = fakeFile({ type: "image" }, "data://download/front.jpg");
  page.onReceivedFile(file);

  file.emit({ readyState: "transferring" });
  assert.deepEqual(images(), [], "nothing before the transfer is done");
  assert.ok(findText("loading"));

  file.emit({ readyState: "transferred" });
  assert.equal(images().length, 1);
  assert.equal(images()[0].props.src, "data://download/front.jpg");
  assert.deepEqual([images()[0].props.x, images()[0].props.y, images()[0].props.w, images()[0].props.h], [CX - 180, TOP + 16, 360, 270]);
  assert.ok(findText("Front door"));
  assert.equal(findText("loading"), undefined);
  assert.ok(button("camera_refresh"));
});

test("camera: enabled, files that are not images are ignored", async () => {
  reset();
  FEATURES.camera = true;
  respond({ GET_ENTITY: ENTITY, CAMERA_SNAPSHOT: { file: "front.jpg" } });
  const page = await openCamera({ entity_id: CAMERA_ID });
  let listeners = 0;
  page.onReceivedFile({ params: { type: "video" }, on: () => listeners++ });
  page.onReceivedFile({ on: () => listeners++ });
  assert.equal(listeners, 0);
  assert.deepEqual(images(), []);
});

test("camera: enabled, the refresh button asks for a new snapshot and shows loading again", async () => {
  reset();
  FEATURES.camera = true;
  respond({ GET_ENTITY: ENTITY, CAMERA_SNAPSHOT: { file: "front.jpg" } });
  const page = await openCamera({ entity_id: CAMERA_ID });
  const file = fakeFile({ type: "image" }, "data://download/front.jpg");
  page.onReceivedFile(file);
  file.emit({ readyState: "transferred" });
  assert.equal(images().length, 1);

  await click(button("camera_refresh"));
  assert.equal(snapshots().length, 2);
  assert.deepEqual(snapshots()[1].params, { entity_id: CAMERA_ID, width: 400, height: 300 });
  assert.ok(findText("loading"));
  assert.deepEqual(images(), [], "the old image is cleared");
});
