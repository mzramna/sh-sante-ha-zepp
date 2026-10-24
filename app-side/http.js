// HTTP to Home Assistant from the phone side service, with LAN-first failover.
import { SETTING } from "../shared/protocol.js";

const get = (key) => settings.settingsStorage.getItem(key);

// Joins without `new URL(path, base)`, which drops a base path such as
// https://host/ha behind a reverse proxy.
export function joinUrl(base, path) {
  return base.replace(/\/+$/, "") + "/" + path.replace(/^\/+/, "");
}

// Base URLs in try order: local, then external.
export function baseUrls() {
  return [get(SETTING.LOCAL_URL), get(SETTING.EXTERNAL_URL)].filter(
    (u) => typeof u === "string" && u.trim() !== ""
  );
}

export class HttpError extends Error {
  constructor(status, body) {
    super(`HTTP ${status}`);
    this.status = status;
    this.body = body;
  }
}

// fetch() of the side service resolves with { status, body }; body may be a
// string or already parsed JSON depending on the Zepp App version.
/** @param {string} url @param {{method?: string, headers?: Record<string, string>, body?: any}} [opts] */
export async function request(url, { method = "GET", headers = {}, body } = {}) {
  const res = await fetch({
    url,
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
  // Some Zepp App versions resolve unreachable hosts with status 0 instead of throwing.
  if (!res || !res.status) throw new Error(`No response from ${url}`);
  let data = res.body;
  if (typeof data === "string" && data !== "") {
    try {
      data = JSON.parse(data);
    } catch (e) {
      // not JSON (e.g. template output), keep the text
    }
  }
  if (res.status < 200 || res.status >= 300) throw new HttpError(res.status, data);
  return data;
}

// Calls the REST API on each base URL until one answers. HTTP errors (the
// server answered) are not retried on the next URL.
/** @param {string} path @param {{method?: string, headers?: Record<string, string>, body?: any}} [opts] */
export async function haRequest(path, opts = {}) {
  const urls = baseUrls();
  if (!urls.length) throw new Error("Home Assistant address not set");
  const token = get(SETTING.TOKEN);
  let lastError;
  for (const base of urls) {
    try {
      return await request(joinUrl(base, path), {
        ...opts,
        headers: { Authorization: `Bearer ${token}`, ...opts.headers },
      });
    } catch (e) {
      if (e instanceof HttpError) throw e;
      lastError = e;
    }
  }
  throw new Error(`Connection error: ${lastError && lastError.message}`);
}
