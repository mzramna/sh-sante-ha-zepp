// Pure logic for the control pages. No @zos imports, so node:test can load it.

// Bits of a cover's supported_features (HA CoverEntityFeature).
export const COVER_FEATURE = { OPEN: 1, CLOSE: 2, SET_POSITION: 4, STOP: 8 };

export const supportsFeature = (features, bit) => ((features || 0) & bit) !== 0;

const HVAC_PREFERRED = ["off", "heat", "cool", "auto"];

// At most `max` modes for the watch: the common ones first, then the rest in HA order.
// shortcut: the current mode is swapped into the last slot when cut, so it can still be coloured
export function pickHvacModes(modes, current, max = 4) {
  const list = modes || [];
  const preferred = HVAC_PREFERRED.filter((m) => list.includes(m));
  const picked = [...preferred, ...list.filter((m) => !preferred.includes(m))].slice(0, max);
  if (current && list.includes(current) && !picked.includes(current)) picked[max - 1] = current;
  return picked;
}

// Left x of each button in a row centred on `centre` (design units).
export function rowX(count, w, gap = 8, centre = 240) {
  const start = centre - (count * w + (count - 1) * gap) / 2;
  return Array.from({ length: count }, (_, i) => start + i * (w + gap));
}

// A code is needed when code_format is set. Arming without one needs code_arm_required false.
// Disarming with a code is not supported on the watch, so it is hidden when a code is needed.
export function alarmPolicy(attrs = {}) {
  const needsCode = Boolean(attrs.code_format);
  return { needsCode, canArm: !needsCode || attrs.code_arm_required === false, canDisarm: !needsCode };
}

// First tap arms, a second tap within windowMs confirms. Pages redraw on each result.
export function createConfirmTap(windowMs = 3000) {
  let armedAt = -Infinity;
  return {
    tap(now) {
      if (now - armedAt <= windowMs) {
        armedAt = -Infinity;
        return true;
      }
      armedAt = now;
      return false;
    },
  };
}

// Trailing debounce: fn runs once, ms after the last call. cancel() drops a pending call.
export function debounce(fn, ms = 600) {
  let timer = null;
  const debounced = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
  debounced.cancel = () => clearTimeout(timer);
  return debounced;
}

export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
