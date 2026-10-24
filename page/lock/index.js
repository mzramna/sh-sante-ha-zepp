import { BasePage } from "@zeppos/zml/base-page";
import * as hmUI from "@zos/ui";
import { getText } from "@zos/i18n";
import { METHOD } from "../../shared/protocol.js";
import { COLOR, CX, DOMAINS, FONT, MARGIN, W } from "../../utils/theme.js";
import { actionButton, clear, createTracked, formatState, loading, message, title, toast } from "../../utils/ui.js";
import { createConfirmTap, wait } from "../../utils/controls.js";

const CONFIRM_MS = 3000;

Page(
  BasePage({
    state: /** @type {Record<string, any>} */ ({}),

    onInit(params) {
      this.state.entity_id = JSON.parse(params).entity_id;
      this.state.list = [];
      this.state.alive = true;
      this.state.armed = false;
      this.state.confirm = createConfirmTap(CONFIRM_MS);
      loading(this.state.list);
      this.load();
    },

    onDestroy() {
      this.state.alive = false;
      clearTimeout(this.state.timer);
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

    act(service) {
      return this.request({
        method: METHOD.CALL_SERVICE,
        params: { domain: "lock", service, entity_id: this.state.entity_id, data: {} },
      })
        .then(() => {
          toast(getText("done"));
          return wait(1000);
        })
        .then(() => this.load())
        .catch((e) => toast(String(e)));
    },

    // Unlocking takes two taps; locking goes straight through.
    onTap() {
      const locked = this.state.entity.state === "locked";
      if (locked && !this.state.confirm.tap(Date.now())) {
        this.state.armed = true;
        this.render();
        clearTimeout(this.state.timer);
        this.state.timer = setTimeout(() => {
          this.state.armed = false;
          this.render();
        }, CONFIRM_MS);
        return;
      }
      clearTimeout(this.state.timer);
      this.state.armed = false;
      this.act(locked ? "unlock" : "lock");
    },

    draw(e) {
      const list = this.state.list;
      const locked = e.state === "locked";
      const armed = this.state.armed && locked;
      title(list, e.name, 16);

      createTracked(list, hmUI.widget.TEXT, {
        x: MARGIN, y: 96, w: W - MARGIN * 2, h: 80,
        text: formatState(e), text_size: FONT.big, color: COLOR.text,
        align_h: hmUI.align.CENTER_H, align_v: hmUI.align.CENTER_V,
      });

      let text = getText(locked ? "unlock_action" : "lock_action");
      if (armed) text = getText("tap_again_to_confirm");
      actionButton(list, {
        x: CX - 160, y: 208, w: 320, h: 96, text,
        color: armed ? COLOR.danger : DOMAINS.lock.color,
        onClick: () => this.onTap(),
      });
    },
  })
);
