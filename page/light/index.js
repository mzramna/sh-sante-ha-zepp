import { getText } from "@zos/i18n";
import { push } from "@zos/router";
import { BasePage } from "@zeppos/zml/base-page";
import { METHOD } from "../../shared/protocol.js";
import { CX, COLOR, DOMAINS } from "../../utils/theme.js";
import { actionButton, clear, formatState, loading, message, title, toast, valueRing } from "../../utils/ui.js";
import { supportsBrightness } from "../../utils/features.js";

Page(
  BasePage({
    state: { entity_id: "", entity: null, widgets: [], brightnessTimer: null, refreshTimer: null },

    onInit(params) {
      this.state.entity_id = JSON.parse(params).entity_id;
      this.load();
    },
    build() {
      loading(this.state.widgets);
    },
    // Back from the effect picker: show the effect that was just set.
    onResume() {
      if (this.state.entity) this.load();
    },
    onDestroy() {
      clearTimeout(this.state.brightnessTimer);
      clearTimeout(this.state.refreshTimer);
    },

    load() {
      this.request({ method: METHOD.GET_ENTITY, params: { entity_id: this.state.entity_id } })
        .then((entity) => {
          this.state.entity = entity;
          // Keep the brightness ring the user is still turning; the pending send refreshes it.
          if (!this.state.brightnessTimer) this.render();
        })
        .catch(() => {
          clear(this.state.widgets);
          message(this.state.widgets, getText("error"));
        });
    },

    render() {
      const { entity, widgets: w } = this.state;
      const attrs = entity.attributes;
      const effects = attrs.effect_list || [];
      clear(w);
      title(w, entity.name);

      const powerX = effects.length ? CX - 170 : CX - 80;
      actionButton(w, {
        x: powerX, y: 88, w: 160, h: 60,
        text: formatState(entity),
        color: entity.state === "on" ? DOMAINS.light.color : COLOR.card,
        onClick: () => this.call("toggle"),
      });

      if (effects.length) {
        actionButton(w, {
          x: CX + 10, y: 88, w: 160, h: 60,
          text: attrs.effect || getText("effect"),
          onClick: () => push({ url: "page/light/effect", params: JSON.stringify({ entity_id: entity.entity_id }) }),
        });
      }

      if (supportsBrightness(attrs.supported_color_modes)) {
        valueRing(w, {
          y: 156,
          value: attrs.brightness_pct || 0,
          onChange: (v) => this.later("brightnessTimer", () => this.call("turn_on", { brightness_pct: v }), 600),
        });
      }
    },

    call(service, data = {}) {
      this.request({ method: METHOD.CALL_SERVICE, params: { domain: "light", service, entity_id: this.state.entity_id, data } })
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
