// Helpers to run a watch page/app-service module against the mocks.
import { state, reset } from "../mocks/state.js";

export { state, reset };

let n = 0;
// Imports the module fresh (new query string) so its Page()/AppService() call
// registers again, and returns that definition.
export async function load(path, kind = "page") {
  await import(new URL(`../../${path}?v=${++n}`, import.meta.url).href);
  const def = globalThis.__zepp[kind];
  if (!def) throw new Error(`${path} did not register a ${kind}`);
  return def;
}

// respond(map): map method -> value | (params) => value | Error.
export function respond(map) {
  state.respond = async ({ method, params }) => {
    if (!(method in map)) throw new Error(`unexpected request ${method}`);
    const v = map[method];
    const r = typeof v === "function" ? await v(params || {}) : v;
    if (r instanceof Error) throw r;
    return r;
  };
}

// Builds a page: onInit(params) then build(), then waits for pending promises.
export async function open(path, params) {
  const page = await load(path, "page");
  page.state = structuredClone(page.state || {});
  page.onInit && page.onInit(params === undefined ? undefined : typeof params === "string" ? params : JSON.stringify(params));
  page.build && page.build();
  await flush();
  return page;
}

export const flush = () => new Promise((r) => setTimeout(r, 0));
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const texts = () => state.widgets.filter((w) => w.props.text !== undefined).map((w) => String(w.props.text));
export const findText = (needle) =>
  state.widgets.find((w) => w.props.text !== undefined && String(w.props.text).includes(needle));

// Clicks a widget: BUTTON click_func or CLICK_UP listeners.
export async function click(w) {
  if (!w) throw new Error("click: widget not found");
  if (w.props.click_func) w.props.click_func(w);
  (w.listeners.CLICK_UP || []).forEach((cb) => cb({}));
  await flush();
}

// The card background under a text widget (entityCard registers the click there).
export function clickable(text) {
  const t = findText(text);
  if (!t) throw new Error(`no widget with text ${text}`);
  if (t.props.click_func || t.listeners.CLICK_UP) return t;
  return state.widgets.find(
    (w) => (w.listeners.CLICK_UP || w.props.click_func) && w.props.y <= t.props.y && t.props.y < w.props.y + w.props.h
  );
}
