import { BasePage } from "@zeppos/zml/base-page";
import * as hmUI from "@zos/ui";
import { getText } from "@zos/i18n";
import { METHOD } from "../../shared/protocol.js";
import { COLOR, DOMAINS, FONT, MARGIN, W } from "../../utils/theme.js";
import { actionButton, clear, createTracked, formatState, loading, message, title, toast, valueRing } from "../../utils/ui.js";
import { debounce, rowX, wait } from "../../utils/controls.js";

const { color } = DOMAINS.fan;

Page(
  BasePage({
    state: /** @type {Record<string, any>} */ ({}),

    onInit(params) {
      this.state.entity_id = JSON.parse(params).entity_id;
      this.state.list = [];
      this.state.alive = true;
      this.state.setSpeed = debounce((percentage) => this.act("set_percentage", { percentage }), 600);
      loading(this.state.list);
      this.load();
    },

    onDestroy() {
      this.state.alive = false;
      this.state.setSpeed.cancel();
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
        params: { domain: "fan", service, entity_id: this.state.entity_id, data },
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
      const isOn = e.state === "on";
      title(list, e.name, 16);

      const buttons = [
        { text: getText("power"), color: isOn ? color : COLOR.card, onClick: () => this.act("toggle") },
      ];
      if (a.oscillating !== undefined) {
        buttons.push({
          text: getText("oscillate"), color: a.oscillating ? color : COLOR.card,
          onClick: () => this.act("oscillate", { oscillating: !a.oscillating }),
        });
      }
      const xs = rowX(buttons.length, 120, 8);
      buttons.forEach((b, i) => actionButton(list, { x: xs[i], y: 64, w: 120, h: 48, ...b }));

      const withRing = a.percentage != null;
      if (withRing) {
        valueRing(list, {
          y: 120, value: a.percentage, min: 0, max: 100, step: a.percentage_step || 10, color,
          onChange: this.state.setSpeed,
        });
      }
      createTracked(list, hmUI.widget.TEXT, {
        x: MARGIN, y: withRing ? 284 : 200, w: W - MARGIN * 2, h: 40,
        text: formatState(e), text_size: FONT.body, color: COLOR.textDim,
        align_h: hmUI.align.CENTER_H, align_v: hmUI.align.CENTER_V,
      });
    },
  })
);
