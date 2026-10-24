// Default for editors and tests. scripts/build.js overwrites this file in each
// build stage with the selected profile from build.config.js.
export const API_LEVEL = "4.0";
export const FEATURES = {
  appService: true,
  zepp2hass: true,
  mobileApp: true,
  camera: false,
  notification: true,
  toast: true,
};
