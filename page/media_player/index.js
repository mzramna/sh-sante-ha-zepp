import * as hmUI from "@zos/ui";
import { getText } from "@zos/i18n";
import { BasePage } from "@zeppos/zml/base-page";
import { METHOD } from "../../shared/protocol.js";
import { CX, COLOR, FONT, MARGIN, W } from "../../utils/theme.js";
import { actionButton, clear, createTracked, loading, message, title, toast, valueRing } from "../../utils/ui.js";
import { MEDIA_FEATURE, hasFeature } from "../../utils/features.js";

const BTN_W = 100;
const BTN_GAP = 8;

Page(
  BasePage({
    state: { entity_id: "", entity: null, widgets: [], pollTimer: null, volumeTimer: null, refreshTimer: null },

    onInit(params) {
      this.state.entity_id = JSON.parse(params).entity_id;
      this.state.pollTimer = setInterval(() => this.load(), 10000);
      this.load();
    },
    build() {
      // shortcut: setLayerScrolling is missing from device-types 4.0.0, move it to types/zos-gaps.d.ts and drop this line
      // @ts-expect-error
      if (hmUI.setLayerScrolling) hmUI.setLayerScrolling(true); // the volume ring sits below the controls
      loading(this.state.widgets);
    },
    onDestroy() {
      clearInterval(this.state.pollTimer);
      clearTimeout(this.state.volumeTimer);
      clearTimeout(this.state.refreshTimer);
    },

    load() {
      this.request({ method: METHOD.GET_ENTITY, params: { entity_id: this.state.entity_id } })
        .then((entity) => {
          this.state.entity = entity;
          // Keep the volume ring the user is still turning; the pending send refreshes it.
          if (!this.state.volumeTimer) this.render();
        })
        .catch(() => {
          clear(this.state.widgets);
          message(this.state.widgets, getText("error"));
        });
    },

    render() {
      const { entity, widgets: w } = this.state;
      const a = entity.attributes;
      const f = a.supported_features;
      clear(w);
      title(w, entity.name);

      createTracked(w, hmUI.widget.TEXT, {
        x: MARGIN, y: 80, w: W - MARGIN * 2, h: 36, text: a.media_title || "", text_size: FONT.body,
        color: COLOR.text, align_h: hmUI.align.CENTER_H, text_style: hmUI.text_style.ELLIPSIS,
      });
      createTracked(w, hmUI.widget.TEXT, {
        x: MARGIN, y: 116, w: W - MARGIN * 2, h: 30, text: a.media_artist || "", text_size: FONT.small,
        color: COLOR.textDim, align_h: hmUI.align.CENTER_H, text_style: hmUI.text_style.ELLIPSIS,
      });

      const buttons = [];
      if (hasFeature(f, MEDIA_FEATURE.PREVIOUS_TRACK)) {
        buttons.push({ text: getText("prev"), onClick: () => this.call("media_previous_track") });
      }
      if (hasFeature(f, MEDIA_FEATURE.PAUSE)) {
        buttons.push({
          text: getText(entity.state === "playing" ? "pause" : "play"),
          onClick: () => this.call("media_play_pause"),
        });
      }
      if (hasFeature(f, MEDIA_FEATURE.NEXT_TRACK)) {
        buttons.push({ text: getText("next"), onClick: () => this.call("media_next_track") });
      }
      if (hasFeature(f, MEDIA_FEATURE.TURN_ON) && hasFeature(f, MEDIA_FEATURE.TURN_OFF)) {
        buttons.push({ text: getText("power"), onClick: () => this.call("toggle") });
      }
      const x0 = CX - (buttons.length * BTN_W + (buttons.length - 1) * BTN_GAP) / 2;
      buttons.forEach((b, i) => actionButton(w, { x: x0 + i * (BTN_W + BTN_GAP), y: 156, w: BTN_W, h: 56, text: b.text, onClick: b.onClick }));

      if (hasFeature(f, MEDIA_FEATURE.VOLUME_SET) && typeof a.volume_level === "number") {
        valueRing(w, {
          y: 224,
          value: Math.round(a.volume_level * 100),
          onChange: (v) => this.later("volumeTimer", () => this.call("volume_set", { volume_level: v / 100 }), 600),
        });
      }
    },

    call(service, data = {}) {
      this.request({ method: METHOD.CALL_SERVICE, params: { domain: "media_player", service, entity_id: this.state.entity_id, data } })
        .then(() => this.later("refreshTimer", () => this.load(), 1000))
        .catch(() => toast(getText("error")));
    },

    // Runs fn once `ms` have passed without another call for the same key (debounce).
    later(key, fn, ms) {
      clearTimeout(this.state[key]);
      this.state[key] = setTimeout(() => {
        this.state[key] = null;
        fn();
      }, ms);
    },
  })
);
