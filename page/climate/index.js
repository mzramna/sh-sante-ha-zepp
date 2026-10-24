import { BasePage } from "@zeppos/zml/base-page";
import * as hmUI from "@zos/ui";
import { getText } from "@zos/i18n";
import { METHOD } from "../../shared/protocol.js";
import { COLOR, DOMAINS, FONT, MARGIN, W } from "../../utils/theme.js";
import { actionButton, clear, createTracked, loading, message, title, toast, valueRing } from "../../utils/ui.js";
import { debounce, pickHvacModes, rowX, wait } from "../../utils/controls.js";

const { color } = DOMAINS.climate;

Page(
  BasePage({
    state: /** @type {Record<string, any>} */ ({}),

    onInit(params) {
      this.state.entity_id = JSON.parse(params).entity_id;
      this.state.list = [];
      this.state.alive = true;
      // Dragging the ring sends one change, after the value settles.
      this.state.setTemp = debounce((temperature) => this.act("set_temperature", { temperature }), 600);
      loading(this.state.list);
      this.load();
    },

    onDestroy() {
      this.state.alive = false;
      this.state.setTemp.cancel();
    },

    load() {
      return this.request({ method: METHOD.GET_ENTITY, params: { entity_id: this.state.entity_id } })
        .then((entity) => {
          if (!this.state.alive) return;
          this.state.entity = entity;
          this.render();
        })
        .catch((e) => {
          if (!this.state.alive) return;
          clear(this.state.list);
          message(this.state.list, String(e), COLOR.danger);
        });
    },

    render() {
      clear(this.state.list);
      this.draw(this.state.entity);
    },

    act(service, data = {}) {
      return this.request({
        method: METHOD.CALL_SERVICE,
        params: { domain: "climate", service, entity_id: this.state.entity_id, data },
      })
        .then(() => {
          toast(getText("done"));
          return wait(1000);
        })
        .then(() => this.load())
        .catch((e) => toast(String(e)));
    },

    draw(e) {
      const list = this.state.list;
      const a = e.attributes || {};
      title(list, e.name, 16);

      const modes = pickHvacModes(a.hvac_modes, e.state);
      const xs = rowX(modes.length, 72, 8);
      modes.forEach((mode, i) =>
        actionButton(list, {
          x: xs[i], y: 64, w: 72, h: 48, text: getText(`state_${mode}`),
          color: mode === e.state ? color : COLOR.card,
          onClick: () => this.act("set_hvac_mode", { hvac_mode: mode }),
        })
      );

      if (a.temperature != null) {
        valueRing(list, {
          y: 120, value: a.temperature, min: a.min_temp || 7, max: a.max_temp || 35,
          step: a.target_temp_step || 0.5, unit: "°", color, onChange: this.state.setTemp,
        });
      }
      if (a.current_temperature != null) {
        createTracked(list, hmUI.widget.TEXT, {
          x: MARGIN, y: 284, w: W - MARGIN * 2, h: 32,
          text: `${getText("current")} ${a.current_temperature}°`, text_size: FONT.small, color: COLOR.textDim,
          align_h: hmUI.align.CENTER_H, align_v: hmUI.align.CENTER_V,
        });
      }
    },
  })
);
