// Pure helpers for the navigation pages (no @zos imports, so tests can run in Node).
import { DOMAINS, domainOf } from "./theme.js";

// Home categories -> domains listed under each (page/entities gets it as `group`).
export const GROUP_DOMAINS = {
  devices: ["light", "switch", "input_boolean", "fan", "climate", "cover", "lock", "vacuum", "media_player", "alarm_control_panel", "camera"],
  scripts: ["script", "scene", "automation", "button", "input_button"],
  sensors: ["sensor", "binary_sensor"],
};

// Entities of one group, in the order they were received.
export const filterGroup = (entities, group) => {
  const domains = GROUP_DOMAINS[group] || [];
  return entities.filter((e) => domains.includes(domainOf(e.entity_id)));
};

// Tap behaviour: open the entity's page, run its service in place, or nothing (sensors).
export function tapAction(entity) {
  const domain = domainOf(entity.entity_id);
  const meta = DOMAINS[domain];
  if (!meta) return null;
  if (meta.page) return { page: meta.page };
  if (meta.tap) return { domain, service: meta.tap };
  return null;
}
