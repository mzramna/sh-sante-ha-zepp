import * as hmUI from "@zos/ui";
import { getText } from "@zos/i18n";
import { set as setAlarm, cancel as cancelAlarm } from "@zos/alarm";
import { localStorage } from "@zos/storage";
import { BasePage } from "@zeppos/zml/base-page";
import { METHOD } from "../../shared/protocol.js";
import { buildPayload } from "../../shared/zepp2hass.js";
import { FEATURES } from "../../config/build.js";
import { W, TOP, MARGIN, COLOR, FONT, RADIUS } from "../../utils/theme.js";
import { createTracked, clear, title, actionButton, toast } from "../../utils/ui.js";
import { collectReadings } from "../../app-service/collect.js";

// Same keys and URL as app-service/sync.js (not imported: it registers the service).
const SELF = "app-service/sync";
const KEY_LAST = "last_sync";
const KEY_ALARM = "sync_alarm_id";
const FIRST_DELAY_SEC = 10;
const CARD_H = 240;

function read(key) {
  try {
    // The typings declare getItem as void; it returns the stored string.
    return /** @type {string | null} */ (/** @type {unknown} */ (localStorage.getItem(key, null)));
  } catch (e) {
    return null;
  }
}

function write(key, value) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch (e) {
    // The status line is only a convenience.
  }
}

function lastSync() {
  const raw = read(KEY_LAST);
  try {
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

const pad = (n) => String(n).padStart(2, "0");
function formatTime(t) {
  const d = new Date(t);
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Cancels the stored alarm (if any) before setting the new one; a 0 id means the system refused it.
function setAutoSync(delaySec) {
  const prev = Number(read(KEY_ALARM) || 0);
  if (prev) {
    try {
      cancelAlarm(prev);
    } catch (e) {
      // Already gone.
    }
  }
  const id = setAlarm({ url: SELF, delay: delaySec, store: true });
  write(KEY_ALARM, id ? String(id) : null);
  return !!id;
}

function stopAutoSync() {
  const prev = Number(read(KEY_ALARM) || 0);
  if (prev) {
    try {
      cancelAlarm(prev);
    } catch (e) {
      // Already gone.
    }
  }
  write(KEY_ALARM, null);
}

Page(
  BasePage({
    state: {
      widgets: [],
      mode: null,
    },
    build() {
      this.render();
      this.request({ method: METHOD.GET_CONFIG, params: {} })
        .then((config) => {
          this.state.mode = config.sensorMode;
        })
        .catch(() => {
          this.state.mode = "unknown";
        })
        .then(() => this.render());
    },
    render() {
      const list = this.state.widgets;
      clear(list);
      title(list, getText("sync_title"));

      const last = lastSync();
      const auto = !!read(KEY_ALARM);
      const lines = [
        `${getText("sync_last")}: ${last ? formatTime(last.time) : getText("sync_never")}`,
        last ? (last.ok ? getText("sync_ok") : `${getText("sync_error")}: ${last.error}`) : "",
        `${getText("sync_mode")}: ${this.state.mode ? getText(`sync_mode_${this.state.mode}`) : "..."}`,
      ];
      if (FEATURES.appService) lines.push(getText(auto ? "sync_auto_on" : "sync_auto_off"));

      let y = TOP + 40;
      createTracked(list, hmUI.widget.FILL_RECT, {
        x: MARGIN, y, w: W - MARGIN * 2, h: CARD_H, radius: RADIUS, color: COLOR.card,
      });
      lines.forEach((text, i) =>
        createTracked(list, hmUI.widget.TEXT, {
          x: MARGIN + 24, y: y + 20 + i * 48, w: W - MARGIN * 2 - 48, h: 40, text,
          text_size: FONT.small, color: COLOR.text, align_v: hmUI.align.CENTER_V,
          text_style: hmUI.text_style.ELLIPSIS,
        })
      );
      y += CARD_H + 24;

      actionButton(list, { x: MARGIN, y, w: W - MARGIN * 2, h: 72, text: getText("sync_now"), onClick: () => this.syncNow() });
      y += 88;
      if (FEATURES.appService) {
        actionButton(list, {
          x: MARGIN, y, w: W - MARGIN * 2, h: 72,
          text: getText(auto ? "sync_stop" : "sync_start"),
          onClick: () => (auto ? this.stopAuto() : this.startAuto()),
        });
      }
    },
    syncNow() {
      let payload;
      try {
        payload = buildPayload(collectReadings());
      } catch (e) {
        return this.finishSync(false, (e && e.message) || String(e));
      }
      return this.request({ method: METHOD.SYNC_SENSORS, params: { payload } })
        .then(() => this.finishSync(true))
        .catch((e) => this.finishSync(false, (e && e.message) || String(e)));
    },
    finishSync(ok, error) {
      write(KEY_LAST, JSON.stringify({ time: Date.now(), ok, error }));
      toast(getText(ok ? "sync_done" : "sync_failed"));
      this.render();
    },
    startAuto() {
      const ok = setAutoSync(FIRST_DELAY_SEC);
      toast(getText(ok ? "sync_started" : "sync_failed"));
      this.render();
    },
    stopAuto() {
      stopAutoSync();
      toast(getText("sync_stopped"));
      this.render();
    },
    onDestroy() {
      clear(this.state.widgets);
    },
  })
);
