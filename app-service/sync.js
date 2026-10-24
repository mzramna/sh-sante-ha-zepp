import { set as setAlarm, cancel as cancelAlarm } from "@zos/alarm";
import { localStorage } from "@zos/storage";
import { notify } from "@zos/notification";
import { getText } from "@zos/i18n";
import { FEATURES } from "../config/build.js";
import { METHOD } from "../shared/protocol.js";
import { buildPayload } from "../shared/zepp2hass.js";
import { collectReadings } from "./collect.js";

// Keys and URL are also used by page/sync/index.js.
const SELF = "app-service/sync";
const KEY_LAST = "last_sync";
const KEY_ALARM = "sync_alarm_id";
const KEY_FAILS = "sync_failures";
const RETRY_SEC = 5 * 60;
const FAILS_BEFORE_NOTIFY = 3;

// Seconds until the next run: the phone's interval after success, a short retry after failure.
export function nextDelaySeconds(result) {
  const minutes = result && result.ok ? Number(result.interval) : 0;
  return minutes > 0 ? minutes * 60 : RETRY_SEC;
}

// Storage can be blocked on a device; the sync carries on without it.
function read(key, fallback) {
  try {
    const v = localStorage.getItem(key, fallback);
    return v == null ? fallback : v;
  } catch (e) {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    // Only the status line is lost.
  }
}

function remove(key) {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    // Nothing stored, nothing to remove.
  }
}

// Id of the alarm this run set; used when storage is blocked so the retry alarm
// set before sending is still replaced instead of piling up.
let lastAlarm = 0;

// Replaces the stored alarm. A 0 id means the system refused it, so nothing is stored.
function scheduleNext(delaySec) {
  const prev = Number(read(KEY_ALARM, 0)) || lastAlarm;
  if (prev) {
    try {
      cancelAlarm(prev);
    } catch (e) {
      // Already fired or gone; nothing to cancel.
    }
  }
  const id = setAlarm({ url: SELF, delay: delaySec, store: true });
  lastAlarm = id || 0;
  if (id) write(KEY_ALARM, id);
  else remove(KEY_ALARM);
}

// The ZML messaging object app.js creates; pages use the same one.
async function sendToPhone() {
  const messaging = /** @type {any} */ (getApp())._options.globalData.messaging;
  const payload = buildPayload(collectReadings());
  const res = await messaging.request({ method: METHOD.SYNC_SENSORS, params: { payload } }, { timeout: 15000 });
  return { ok: true, interval: res.interval };
}

export async function runSync() {
  // A retry is set before sending, so a service killed mid-sync still runs again.
  scheduleNext(RETRY_SEC);
  /** @type {{ ok: boolean, interval?: number, error?: string }} */
  let result;
  try {
    result = await sendToPhone();
  } catch (e) {
    result = { ok: false, error: (e && e.message) || String(e) };
  }
  write(KEY_LAST, JSON.stringify({ time: Date.now(), ok: result.ok, error: result.error }));

  let fails = result.ok ? 0 : Number(read(KEY_FAILS, 0)) + 1;
  if (fails >= FAILS_BEFORE_NOTIFY) {
    if (FEATURES.notification) {
      notify({ title: getText("sync_failing_title"), content: getText("sync_failing_body"), actions: [] });
    }
    fails = 0;
  }
  write(KEY_FAILS, fails);
  scheduleNext(nextDelaySeconds(result));
  return result;
}

AppService({
  onInit() {
    return runSync();
  },
  onDestroy() {},
});
