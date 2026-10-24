import { getText } from "@zos/i18n";
import { BasePage } from "@zeppos/zml/base-page";
import { METHOD } from "../../shared/protocol.js";
import { TOP, COLOR } from "../../utils/theme.js";
import { clear, title, message, loading, entityCard } from "../../utils/ui.js";
import { filterGroup } from "../../utils/groups.js";
import { runTap } from "../../utils/nav.js";

// Params (JSON string): { group } | { area_id, name } | { ids, title }.
Page(
  BasePage({
    state: {
      query: null, // set in onInit from the route params
      entities: [],
      widgets: [],
      alive: false,
    },
    onInit(params) {
      this.state.query = JSON.parse(params || "{}");
    },
    build() {
      this.state.alive = true;
      loading(this.state.widgets);
      this.load();
    },
    load() {
      const q = this.state.query;
      const fetched = q.area_id ? this.fetchArea(q.area_id) : this.fetchEntities(q);
      return fetched
        .then((entities) => {
          if (!this.state.alive) return;
          this.state.entities = entities;
          this.render();
        })
        .catch((e) => {
          if (!this.state.alive) return;
          clear(this.state.widgets);
          message(this.state.widgets, (e && e.message) || String(e), COLOR.danger);
        });
    },
    fetchArea(areaId) {
      return this.request({ method: METHOD.GET_AREAS, params: {} }).then((areas) => {
        const area = areas.find((a) => a.area_id === areaId);
        return this.fetchIds(area ? area.entity_ids : []);
      });
    },
    fetchEntities(q) {
      if (q.ids) return this.fetchIds(q.ids);
      return this.request({ method: METHOD.GET_ENTITIES, params: {} }).then((all) =>
        filterGroup(all, q.group)
      );
    },
    fetchIds(ids) {
      if (!ids.length) return Promise.resolve([]);
      return this.request({ method: METHOD.GET_ENTITIES, params: { ids } });
    },
    render() {
      clear(this.state.widgets);
      const list = this.state.widgets;
      title(list, this.heading());
      if (!this.state.entities.length) {
        message(list, getText("no_entities"));
        return;
      }
      let y = TOP + 12;
      for (const entity of this.state.entities) {
        y = entityCard(list, { y, entity, onClick: (en) => this.tap(en) });
      }
    },
    tap(entity) {
      runTap(this, entity, (fresh) => {
        this.state.entities = this.state.entities.map((en) => (en.entity_id === fresh.entity_id ? fresh : en));
        this.render();
      });
    },
    heading() {
      const q = this.state.query;
      return q.group ? getText(q.group) : q.name || q.title || "";
    },
    onDestroy() {
      this.state.alive = false;
      clear(this.state.widgets);
    },
  })
);
