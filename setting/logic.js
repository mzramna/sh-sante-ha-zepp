// Pure helpers of the phone settings page (setting/index.js), kept apart so Node can test them.
import { DOMAINS } from "../utils/theme.js";
import { ENTITY_ID, NAME, readList } from "../shared/validate.js";

export const SENSOR_MODES = ["none", "zepp2hass", "mobile_app", "rest"];
export const SYNC_INTERVALS = [1, 5, 10, 15, 30, 60];

export const isHttpUrl = (s) => /^https?:\/\/\S/.test(s);

// The HA notify service without its "notify." prefix; "" clears it; null when invalid.
export function normalizeNotifyService(raw) {
  const value = String(raw).trim().replace(/^notify\./, "");
  if (value === "") return "";
  return NAME.test(value) ? value : null;
}

// Entity id of the Sleep as Android status; "" clears it; null when invalid.
export function normalizeStatusEntity(raw) {
  const value = String(raw).trim();
  if (value === "") return "";
  return ENTITY_ID.test(value) ? value : null;
}

// Entries of the stored entity list that have a key; the order is kept.
export const readEntities = (text) => readList(text).filter((item) => item && typeof item.key === "string");

// Entities the page lists: a supported domain, and the id contains the search text (1.x behaviour).
export function visibleEntities(list, filter) {
  return list.filter(
    (item) => Object.prototype.hasOwnProperty.call(DOMAINS, item.key.split(".")[0]) && item.key.includes(filter || "")
  );
}

export const setEnabled = (list, key, on) => list.map((item) => (item.key === key ? { ...item, value: on } : item));

// Favourites keep the order they were marked in.
export function setFavorite(favorites, id, on) {
  if (!on) return favorites.filter((f) => f !== id);
  return favorites.includes(id) ? favorites.slice() : [...favorites, id];
}

// Moves the entity with this key to the front; the others keep their order.
export function moveToTop(list, key) {
  const index = list.findIndex((item) => item.key === key);
  if (index <= 0) return list.slice();
  return [list[index], ...list.slice(0, index), ...list.slice(index + 1)];
}
