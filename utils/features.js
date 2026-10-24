// Pure feature checks for the light and media pages (no @zos imports, so tests can run in Node).

// Home Assistant media_player SUPPORT_* bits.
export const MEDIA_FEATURE = {
  PAUSE: 1,
  VOLUME_SET: 4,
  PREVIOUS_TRACK: 16,
  NEXT_TRACK: 32,
  TURN_ON: 128,
  TURN_OFF: 256,
};

// HA 2022.5+ no longer reports brightness in supported_features; any mode but "onoff" implies it.
export const supportsBrightness = (colorModes) => (colorModes || []).some((m) => m !== "onoff");
