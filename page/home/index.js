import * as hmUI from "@zos/ui";
import { push } from "@zos/router";
import { getText } from "@zos/i18n";
import { BasePage } from "@zeppos/zml/base-page";
import { METHOD } from "../../shared/protocol.js";
import { FEATURES } from "../../config/build.js";
import { W, TOP, MARGIN, COLOR, FONT } from "../../utils/theme.js";
import { createTracked, clear, title, message, loading, entityCard, actionButton, toast } from "../../utils/ui.js";
import { tapAction } from "../../utils/groups.js";

const CATEGORY_H = 80;
const GAP = 12;

Page(
  BasePage({
    state: {
      widgets: [],
    },
    build() {
      loading(this.state.widgets);
      this.load();
    },
    load() {
      return Promise.all([
        this.request({ method: METHOD.GET_CONFIG, params: {} }),
        this.request({ method: METHOD.GET_ENTITIES, params: {} }),
      ])
        .then(([config, entities]) => {
          clear(this.state.widgets);
          this.render(config, entities);
        })
        .catch((e) => {
          clear(this.state.widgets);
          message(this.state.widgets, (e && e.message) || String(e), COLOR.danger);
        });
    },
    render(config, entities) {
      const list = this.state.widgets;
      title(list, "Home Assistant");
      let y = TOP + 12; // below the title

      const favorites = (config.favorites || [])
        .map((id) => entities.find((en) => en.entity_id === id))
        .filter(Boolean);
      if (favorites.length) {
        createTracked(list, hmUI.widget.TEXT, {
          x: MARGIN, y, w: W - MARGIN * 2, h: 36, text: getText("favorites"),
          text_size: FONT.small, color: COLOR.textDim, align_v: hmUI.align.CENTER_V,
        });
        y += 44;
        for (const entity of favorites) {
          y = entityCard(list, { y, entity, onClick: (en) => this.tap(en) });
        }
        y += 12;
      }

      const categories = [
        { text: getText("devices"), onClick: () => this.open("page/entities/index", { group: "devices" }) },
        { text: getText("scripts"), onClick: () => this.open("page/entities/index", { group: "scripts" }) },
        { text: getText("sensors"), onClick: () => this.open("page/entities/index", { group: "sensors" }) },
        { text: getText("areas"), onClick: () => this.open("page/areas/index") },
      ];
      if (FEATURES.appService || config.sensorMode !== "none") {
        categories.push({ text: getText("sync"), onClick: () => this.open("page/sync/index") });
      }
      for (const c of categories) {
        actionButton(list, { x: MARGIN, y, w: W - MARGIN * 2, h: CATEGORY_H, text: c.text, onClick: c.onClick });
        y += CATEGORY_H + GAP;
      }
    },
    open(url, params) {
      push({ url, params: params && JSON.stringify(params) });
    },
    tap(entity) {
      const action = tapAction(entity);
      if (!action) return;
      if (action.page) {
        this.open(action.page, { entity_id: entity.entity_id });
        return;
      }
      this.request({
        method: METHOD.CALL_SERVICE,
        params: { domain: action.domain, service: action.service, entity_id: entity.entity_id },
      })
        .then(() => {
          toast(getText("done"));
          return this.load();
        })
        .catch(() => toast(getText("action_failed")));
    },
    onDestroy() {
      clear(this.state.widgets);
    },
  })
);
