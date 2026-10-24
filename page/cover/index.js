import { BasePage } from "@zeppos/zml/base-page";
import * as hmUI from "@zos/ui";
import { getText } from "@zos/i18n";
import { METHOD } from "../../shared/protocol.js";
import { COLOR, DOMAINS, FONT, MARGIN, W } from "../../utils/theme.js";
import { actionButton, clear, createTracked, formatState, loading, message, title, toast, valueRing } from "../../utils/ui.js";
import { COVER_FEATURE, debounce, rowX, supportsFeature, wait } from "../../utils/controls.js";

const { color } = DOMAINS.cover;

Page(
  BasePage({
    state: /** @type {Record<string, any>} */ ({}),

    onInit(params) {
      this.state.entity_id = JSON.parse(params).entity_id;
      this.state.list = [];
      this.state.alive = true;
      this.state.setPos = debounce((position) => this.act("set_cover_position", { position }), 600);
      loading(this.state.list);
      this.load();
    },

    onDestroy() {
      this.state.alive = false;
      this.state.setPos.cancel();
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
        params: { domain: "cover", service, entity_id: this.state.entity_id, data },
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
      const f = a.supported_features;
      title(list, e.name, 16);

      const buttons = [
        [COVER_FEATURE.OPEN, getText("open"), "open_cover"],
        [COVER_FEATURE.STOP, getText("stop"), "stop_cover"],
        [COVER_FEATURE.CLOSE, getText("close"), "close_cover"],
      ].filter(([bit]) => supportsFeature(f, bit));
      const xs = rowX(buttons.length, 100, 8);
      buttons.forEach(([, text, service], i) =>
        actionButton(list, { x: xs[i], y: 64, w: 100, h: 48, text, onClick: () => this.act(service) })
      );

      const withRing = supportsFeature(f, COVER_FEATURE.SET_POSITION);
      if (withRing) {
        valueRing(list, {
          y: 120, value: a.current_position || 0, min: 0, max: 100, step: 10, color,
          onChange: this.state.setPos,
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
