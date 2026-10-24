// Shared watch widgets so every page has the same look. Inputs are design units
// (see utils/theme.js); px() scales them to the real screen.
import * as hmUI from "@zos/ui";
import { px } from "@zos/utils";
import { getText } from "@zos/i18n";
import { showToast } from "@zos/interaction";
import { FEATURES } from "../config/build.js";
import { W, CX, COLOR, FONT, RADIUS, MARGIN, TOP, domainMeta } from "./theme.js";

// Every create* call goes through here so pages can clear what they drew.
export function createTracked(list, type, opts) {
  const scaled = {};
  for (const k in opts) {
    scaled[k] = ["x", "y", "w", "h", "text_size", "radius", "line_width", "center_x", "center_y"].includes(k)
      ? px(opts[k])
      : opts[k];
  }
  const w = hmUI.createWidget(type, scaled);
  list.push(w);
  return w;
}

export function clear(list) {
  while (list.length) hmUI.deleteWidget(list.pop());
}

export function title(list, text, y = TOP - 40) {
  return createTracked(list, hmUI.widget.TEXT, {
    x: MARGIN, y, w: W - MARGIN * 2, h: 44,
    text, text_size: FONT.title, color: COLOR.text,
    align_h: hmUI.align.CENTER_H, align_v: hmUI.align.CENTER_V,
  });
}

// Full screen centered text: loading, empty and error states.
export function message(list, text, color = COLOR.textDim) {
  return createTracked(list, hmUI.widget.TEXT, {
    x: MARGIN, y: 0, w: W - MARGIN * 2, h: W,
    text, text_size: FONT.body, color,
    align_h: hmUI.align.CENTER_H, align_v: hmUI.align.CENTER_V,
    text_style: hmUI.text_style.WRAP,
  });
}

export const loading = (list) => message(list, getText("loading"));

// One entity row: icon, name, state. Returns the y below the card.
export function entityCard(list, { y, entity, onClick, h = 96 }) {
  const meta = domainMeta(entity.entity_id);
  const isOn = ["on", "open", "unlocked", "playing", "heat", "cool", "auto", "cleaning"].includes(entity.state);
  const bg = createTracked(list, hmUI.widget.FILL_RECT, {
    x: MARGIN, y, w: W - MARGIN * 2, h, radius: RADIUS, color: COLOR.card,
  });
  createTracked(list, hmUI.widget.FILL_RECT, {
    x: MARGIN + 20, y: y + h / 2 - 28, w: 56, h: 56, radius: 28, color: isOn ? meta.color : COLOR.off,
  });
  createTracked(list, hmUI.widget.IMG, { x: MARGIN + 32, y: y + h / 2 - 16, src: `icons/${meta.icon}` });
  createTracked(list, hmUI.widget.TEXT, {
    x: MARGIN + 92, y: y + 12, w: W - MARGIN * 2 - 112, h: 40,
    text: entity.name, text_size: FONT.body, color: COLOR.text,
    align_v: hmUI.align.CENTER_V, text_style: hmUI.text_style.ELLIPSIS,
  });
  createTracked(list, hmUI.widget.TEXT, {
    x: MARGIN + 92, y: y + 52, w: W - MARGIN * 2 - 112, h: 32,
    text: formatState(entity), text_size: FONT.small, color: isOn ? meta.color : COLOR.textDim,
    align_v: hmUI.align.CENTER_V, text_style: hmUI.text_style.ELLIPSIS,
  });
  if (onClick) bg.addEventListener(hmUI.event.CLICK_UP, () => onClick(entity));
  return y + h + 12;
}

export function formatState(entity) {
  const key = `state_${entity.state}`;
  const translated = getText(key);
  const state = translated && translated !== key ? translated : entity.state;
  return entity.unit ? `${state} ${entity.unit}` : state;
}

// Big round button with a text label, used for actions (toggle, open, lock...).
export function actionButton(list, { x, y, w = 160, h = 72, text, color = COLOR.card, onClick }) {
  return createTracked(list, hmUI.widget.BUTTON, {
    x, y, w, h, radius: h / 2, text, text_size: FONT.body, color: COLOR.text,
    normal_color: color, press_color: COLOR.cardPressed, click_func: onClick,
  });
}

// Ring showing value in [min, max] with - / + buttons under it. Returns { set(v) }.
// Used for brightness, temperature, position, speed and volume.
export function valueRing(list, { y, value, min = 0, max = 100, step = 10, unit = "%", color = COLOR.accent, onChange }) {
  const size = 240;
  const x = CX - size / 2;
  createTracked(list, hmUI.widget.ARC, {
    x, y, w: size, h: size, start_angle: -225, end_angle: 45, color: COLOR.off, line_width: 20,
  });
  const fg = createTracked(list, hmUI.widget.ARC, {
    x, y, w: size, h: size, start_angle: -225, end_angle: -225, color, line_width: 20,
  });
  const label = createTracked(list, hmUI.widget.TEXT, {
    x, y: y + size / 2 - 40, w: size, h: 80, text: "", text_size: FONT.big, color: COLOR.text,
    align_h: hmUI.align.CENTER_H, align_v: hmUI.align.CENTER_V,
  });
  let current = value;
  const set = (v) => {
    current = Math.min(max, Math.max(min, v));
    const angle = -225 + ((current - min) / (max - min || 1)) * 270;
    fg.setProperty(hmUI.prop.MORE, { end_angle: angle });
    label.setProperty(hmUI.prop.MORE, { text: `${Math.round(current * 10) / 10}${unit}` });
  };
  set(value);
  const change = (d) => {
    set(current + d);
    onChange && onChange(current);
  };
  actionButton(list, { x: CX - 150, y: y + size + 8, w: 120, text: "−", onClick: () => change(-step) });
  actionButton(list, { x: CX + 30, y: y + size + 8, w: 120, text: "+", onClick: () => change(step) });
  return { set, get: () => current, bottom: y + size + 88 };
}

export function toast(text) {
  if (FEATURES.toast) showToast({ content: text });
}
