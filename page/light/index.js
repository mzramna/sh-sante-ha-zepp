import { getText } from "@zos/i18n";
import { push } from "@zos/router";
import { CX, COLOR, DOMAINS } from "../../utils/theme.js";
import { entityPage } from "../../utils/entity-page.js";
import { actionButton, formatState, title, valueRing } from "../../utils/ui.js";
import { supportsBrightness } from "../../utils/features.js";

// Named so the object is not an inline literal: entityPage's JSDoc type has no onResume key.
const options = {
  domain: "light",
  draw(entity, w) {
    const attrs = entity.attributes;
    const effects = attrs.effect_list || [];
    title(w, entity.name);

    const powerX = effects.length ? CX - 170 : CX - 80;
    actionButton(w, {
      x: powerX, y: 88, w: 160, h: 60,
      text: formatState(entity),
      color: entity.state === "on" ? DOMAINS.light.color : COLOR.card,
      onClick: () => this.act("toggle"),
    });

    if (effects.length) {
      actionButton(w, {
        x: CX + 10, y: 88, w: 160, h: 60,
        text: attrs.effect || getText("effect"),
        onClick: () => push({ url: "page/light/effect", params: JSON.stringify({ entity_id: entity.entity_id }) }),
      });
    }

    if (supportsBrightness(attrs.supported_color_modes)) {
      valueRing(w, {
        y: 156,
        value: attrs.brightness_pct || 0,
        onChange: this.debounced("brightness", (v) => this.act("turn_on", { brightness_pct: v })),
      });
    }
  },
  // Back from the effect picker: show the effect that was just set.
  onResume() {
    this.load();
  },
};

Page(entityPage(options));
