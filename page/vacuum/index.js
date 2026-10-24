import { BasePage } from "@zeppos/zml/base-page";
import * as hmUI from "@zos/ui";
import { getText } from "@zos/i18n";
import { METHOD } from "../../shared/protocol.js";
import { COLOR, FONT, MARGIN, W } from "../../utils/theme.js";
import { actionButton, clear, createTracked, formatState, loading, message, title, toast } from "../../utils/ui.js";
import { rowX, wait } from "../../utils/controls.js";

Page(
  BasePage({
    state: /** @type {Record<string, any>} */ ({}),

    onInit(params) {
      this.state.entity_id = JSON.parse(params).entity_id;
      this.state.list = [];
      this.state.alive = true;
      loading(this.state.list);
      this.load();
    },

    onDestroy() {
      this.state.alive = false;
    },

    load() {
      return this.request({ method: METHOD.GET_ENTITY, params: { entity_id: this.state.entity_id } })
        .then((entity) => {
          if (!this.state.alive) return;
          clear(this.state.list);
          this.draw(entity);
        })
        .catch((e) => {
          if (!this.state.alive) return;
          clear(this.state.list);
          message(this.state.list, String(e), COLOR.danger);
        });
    },

    act(service) {
      return this.request({
        method: METHOD.CALL_SERVICE,
        params: { domain: "vacuum", service, entity_id: this.state.entity_id, data: {} },
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

      createTracked(list, hmUI.widget.TEXT, {
        x: MARGIN, y: 64, w: W - MARGIN * 2, h: 40,
        text: formatState(e), text_size: FONT.body, color: COLOR.text,
        align_h: hmUI.align.CENTER_H, align_v: hmUI.align.CENTER_V,
      });
      if (a.battery_level != null) {
        createTracked(list, hmUI.widget.TEXT, {
          x: MARGIN, y: 104, w: W - MARGIN * 2, h: 32,
          text: `${getText("battery")} ${a.battery_level}%`, text_size: FONT.small, color: COLOR.textDim,
          align_h: hmUI.align.CENTER_H, align_v: hmUI.align.CENTER_V,
        });
      }

      const buttons = [
        { text: getText("start"), service: "start" },
        { text: getText("pause"), service: "pause" },
        { text: getText("dock"), service: "return_to_base" },
        { text: getText("locate"), service: "locate" },
      ];
      const xs = rowX(2, 160, 16);
      buttons.forEach((b, i) =>
        actionButton(list, {
          x: xs[i % 2], y: 152 + Math.floor(i / 2) * 88, w: 160, h: 72, text: b.text,
          onClick: () => this.act(b.service),
        })
      );
    },
  })
);
