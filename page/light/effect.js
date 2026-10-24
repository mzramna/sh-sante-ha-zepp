import * as hmUI from "@zos/ui";
import { getText } from "@zos/i18n";
import { back } from "@zos/router";
import { BasePage } from "@zeppos/zml/base-page";
import { METHOD } from "../../shared/protocol.js";
import { COLOR, DOMAINS, FONT, MARGIN, RADIUS, W } from "../../utils/theme.js";
import { clear, createTracked, loading, message, title, toast } from "../../utils/ui.js";

const FIRST_ROW_Y = 84;
const ROW_H = 74; // card 64 + 10 gap

Page(
  BasePage({
    state: { entity_id: "", widgets: [] },

    onInit(params) {
      this.state.entity_id = JSON.parse(params).entity_id;
      this.request({ method: METHOD.GET_ENTITY, params: { entity_id: this.state.entity_id } })
        .then((entity) => this.render(entity))
        .catch(() => {
          clear(this.state.widgets);
          message(this.state.widgets, getText("error"));
        });
    },
    build() {
      // shortcut: setLayerScrolling is missing from device-types 4.0.0, move it to types/zos-gaps.d.ts and drop this line
      // @ts-expect-error
      if (hmUI.setLayerScrolling) hmUI.setLayerScrolling(true); // long effect lists scroll past the screen
      loading(this.state.widgets);
    },

    render(entity) {
      const w = this.state.widgets;
      clear(w);
      title(w, getText("effect"));
      (entity.attributes.effect_list || []).forEach((name, i) => {
        const current = name === entity.attributes.effect;
        const y = FIRST_ROW_Y + i * ROW_H;
        const card = createTracked(w, hmUI.widget.FILL_RECT, {
          x: MARGIN, y, w: W - MARGIN * 2, h: 64, radius: RADIUS,
          color: current ? DOMAINS.light.color : COLOR.card,
        });
        const label = createTracked(w, hmUI.widget.TEXT, {
          x: MARGIN + 20, y, w: W - MARGIN * 2 - 40, h: 64, text: name, text_size: FONT.body,
          color: current ? COLOR.bg : COLOR.text,
          align_v: hmUI.align.CENTER_V, text_style: hmUI.text_style.ELLIPSIS,
        });
        // Clicks on the label must select too, since it sits on top of the card.
        for (const el of [card, label]) el.addEventListener(hmUI.event.CLICK_UP, () => this.apply(name));
      });
    },

    apply(name) {
      this.request({
        method: METHOD.CALL_SERVICE,
        params: { domain: "light", service: "turn_on", entity_id: this.state.entity_id, data: { effect: name } },
      })
        .then(() => {
          toast(name);
          back();
        })
        .catch(() => toast(getText("error")));
    },
  })
);
