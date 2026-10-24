import { BasePage } from "@zeppos/zml/base-page";
import * as hmUI from "@zos/ui";
import { getText } from "@zos/i18n";
import { METHOD } from "../../shared/protocol.js";
import { COLOR, CX, DOMAINS, FONT, MARGIN, W } from "../../utils/theme.js";
import { actionButton, clear, createTracked, formatState, loading, message, title, toast } from "../../utils/ui.js";
import { alarmPolicy, createConfirmTap, wait } from "../../utils/controls.js";

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
        params: { domain: "alarm_control_panel", service, entity_id: this.state.entity_id, data: {} },
      })
        .then(() => {
          toast(getText("done"));
          return wait(1000);
        })
        .then(() => this.load())
        .catch((e) => toast(String(e)));
    },

    // Disarming takes two taps, like unlocking a lock.
    onDisarm() {
      if (!this.state.confirm.tap(Date.now())) {
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
      this.act("alarm_disarm");
    },

    draw(e) {
      const list = this.state.list;
      const policy = alarmPolicy(e.attributes);
      title(list, e.name, 16);

      createTracked(list, hmUI.widget.TEXT, {
        x: MARGIN, y: 64, w: W - MARGIN * 2, h: 40,
        text: formatState(e), text_size: FONT.body, color: COLOR.text,
        align_h: hmUI.align.CENTER_H, align_v: hmUI.align.CENTER_V,
      });
      if (policy.needsCode) {
        createTracked(list, hmUI.widget.TEXT, {
          x: MARGIN, y: 104, w: W - MARGIN * 2, h: 32,
          text: getText("alarm_code_required"), text_size: FONT.small, color: COLOR.textDim,
          align_h: hmUI.align.CENTER_H, align_v: hmUI.align.CENTER_V,
        });
      }

      const buttons = [];
      if (policy.canArm) {
        buttons.push({ text: getText("arm_home"), onClick: () => this.act("alarm_arm_home") });
        buttons.push({ text: getText("arm_away"), onClick: () => this.act("alarm_arm_away") });
      }
      if (policy.canDisarm) {
        const armed = this.state.armed;
        buttons.push({
          text: getText(armed ? "tap_again_to_confirm" : "disarm"),
          color: armed ? COLOR.danger : COLOR.card,
          onClick: () => this.onDisarm(),
        });
      }
      buttons.forEach((b, i) =>
        actionButton(list, { x: CX - 140, y: 152 + i * 76, w: 280, h: 64, color: DOMAINS.alarm_control_panel.color, ...b })
      );
    },
  })
);
