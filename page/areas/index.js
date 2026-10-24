import { push } from "@zos/router";
import { getText } from "@zos/i18n";
import { BasePage } from "@zeppos/zml/base-page";
import { METHOD } from "../../shared/protocol.js";
import { TOP, COLOR } from "../../utils/theme.js";
import { clear, title, message, loading, entityCard } from "../../utils/ui.js";

Page(
  BasePage({
    state: {
      widgets: [],
      alive: false,
    },
    build() {
      this.state.alive = true;
      loading(this.state.widgets);
      this.request({ method: METHOD.GET_AREAS, params: {} })
        .then((areas) => {
          if (!this.state.alive) return;
          this.render(areas);
        })
        .catch((e) => {
          if (!this.state.alive) return;
          clear(this.state.widgets);
          message(this.state.widgets, (e && e.message) || String(e), COLOR.danger);
        });
    },
    render(areas) {
      clear(this.state.widgets);
      const list = this.state.widgets;
      title(list, getText("areas"));
      if (!areas.length) {
        message(list, getText("no_areas"));
        return;
      }
      let y = TOP + 12;
      for (const area of areas) {
        // Fake entity: entityCard draws the row, the count is the subtitle.
        const entity = {
          entity_id: "sensor.area",
          name: area.name,
          state: `${area.entity_ids.length} ${getText("entities")}`,
        };
        y = entityCard(list, {
          y,
          entity,
          onClick: () => push({ url: "page/entities/index", params: JSON.stringify({ area_id: area.area_id, name: area.name }) }),
        });
      }
    },
    onDestroy() {
      this.state.alive = false;
      clear(this.state.widgets);
    },
  })
);
