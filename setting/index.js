// Phone settings page: Home Assistant access, entities, health data sync and Sleep as Android.
// Everything is read from settingsStorage on each build; the side service does the HA work.
import { gettext } from "i18n"
import { SETTING } from "../shared/protocol.js"
import { parseJson, readList } from "../shared/validate.js"
import {
  SENSOR_MODES,
  SYNC_INTERVALS,
  isHttpUrl,
  normalizeNotifyService,
  normalizeStatusEntity,
  readEntities,
  visibleEntities,
  setEnabled,
  setFavorite,
  moveToTop,
} from "./logic.js"

const FILTER_KEY = "filter" // entity search text, kept on the phone as in 1.x
// field -> message for the last invalid value. In storage, not page state: a change rebuilds the page.
const ERRORS_KEY = "settingsErrors"
const MODE_LABELS = { none: "Off", zepp2hass: "zepp2hass", mobile_app: "Mobile app", rest: "REST API" }
const RED = "#d32f2f"

const inputStyle = {
  color: "#000000",
  fontSize: "15px",
  borderStyle: "solid",
  borderColor: "#000000",
  borderRadius: "2px",
  height: "28px",
  overflow: "hidden",
  borderWidth: "2px",
  margin: "10px",
}
const buttonStyle = { fontSize: "14px", height: "32px", borderRadius: "16px", margin: "10px" }
const topStyle = { fontSize: "12px", height: "24px", borderRadius: "12px", background: "#3ddc84", color: "black" }
const headingStyle = { fontSize: "17px", fontWeight: "bold", paddingLeft: "10px", paddingTop: "10px", paddingBottom: "5px" }
const hintStyle = { fontSize: "13px", fontStyle: "italic", paddingLeft: "10px" }
const errorStyle = { fontSize: "13px", color: RED, paddingLeft: "10px" }
const rowStyle = { display: "flex", flexDirection: "column", padding: "6px 0", borderBottom: "1px solid #eaeaea" }
const favRowStyle = { display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }

const Heading = (msgid) => Section({ style: headingStyle }, gettext(msgid))
const Hint = (text) => Text({ style: hintStyle }, text)
const ErrorText = (text) => Text({ style: errorStyle }, text)

// The last SETTING.STATUS message (from Refresh entities or Register), red when it failed.
function statusLine(store) {
  const status = parseJson(store.getItem(SETTING.STATUS) || "", null)
  if (!status) return []
  return [Text({ style: status.ok ? hintStyle : errorStyle }, String(status.message || ""))]
}

// Saves a checked value (null = invalid, the stored setting stays) and sets or clears the field's error.
// The error is written last, so the one rebuild it triggers shows the final state.
function saveChecked(store, field, key, value, message) {
  if (value !== null) store.setItem(key, value)
  const errors = parseJson(store.getItem(ERRORS_KEY), {})
  if (value === null) errors[field] = message
  else delete errors[field]
  store.setItem(ERRORS_KEY, JSON.stringify(errors))
}

AppSettingsPage({
  build(props) {
    const store = props.settingsStorage
    const get = (key) => store.getItem(key) || ""
    const errors = parseJson(get(ERRORS_KEY), {})
    const mode = get(SETTING.SENSOR_MODE) || "none"

    const saveEntities = (list) => store.setItem(SETTING.ENTITY_LIST, JSON.stringify(list))
    const saveFavorites = (list) => store.setItem(SETTING.FAVORITES, JSON.stringify(list))
    const favorites = readList(get(SETTING.FAVORITES))
    const entities = readEntities(get(SETTING.ENTITY_LIST))
    const shown = visibleEntities(entities, get(FILTER_KEY))

    const rows = shown.map((item) =>
      View({ style: rowStyle }, [
        Toggle({
          label: `${item.title} (${item.key})`,
          value: item.value === true,
          onChange: (on) => saveEntities(setEnabled(readEntities(get(SETTING.ENTITY_LIST)), item.key, on)),
        }),
        View({ style: favRowStyle }, [
          Toggle({
            label: `★ ${gettext("Favorite")}`,
            value: favorites.includes(item.key),
            onChange: (on) => saveFavorites(setFavorite(readList(get(SETTING.FAVORITES)), item.key, on)),
          }),
          Button({
            label: gettext("Top"),
            style: topStyle,
            onClick: () => saveEntities(moveToTop(readEntities(get(SETTING.ENTITY_LIST)), item.key)),
          }),
        ]),
      ])
    )

    const last = parseJson(get(SETTING.LAST_SYNC), null)
    const lastOk = !!(last && last.ok)
    const lastText = !last
      ? gettext("No sync yet")
      : lastOk
        ? `${gettext("Last sync")}: ${new Date(last.time).toLocaleString()}`
        : `${gettext("Last sync failed")}: ${last.error || ""}`

    return View({ style: { padding: "12px 20px" } }, [
      // Access to Home Assistant
      Heading("Access"),
      Hint("e.g. http://homeassistant.local:8123/"),
      TextInput({ label: gettext("IPLocal"), value: get(SETTING.LOCAL_URL), subStyle: inputStyle, onChange: (raw) => store.setItem(SETTING.LOCAL_URL, raw.trim()) }),
      Hint("e.g. https://example.com/"),
      TextInput({ label: gettext("IPExternal"), value: get(SETTING.EXTERNAL_URL), subStyle: inputStyle, onChange: (raw) => store.setItem(SETTING.EXTERNAL_URL, raw.trim()) }),
      Hint(gettext("FromProfile")),
      TextInput({ label: gettext("LongToken"), value: get(SETTING.TOKEN), subStyle: inputStyle, onChange: (raw) => store.setItem(SETTING.TOKEN, raw.trim()) }),
      Button({
        label: gettext("Refresh entities"),
        style: buttonStyle,
        onClick: () => store.setItem(SETTING.REFRESH_ENTITIES, String(Date.now())),
      }),
      Hint(gettext("Loads your entities from Home Assistant. Your choices are kept.")),
      ...statusLine(store),

      // Entities shown on the watch
      Heading("Entities"),
      Hint(gettext("SearchEntities")),
      TextInput({ label: gettext("Filter"), value: get(FILTER_KEY), subStyle: inputStyle, onChange: (raw) => store.setItem(FILTER_KEY, raw) }),
      entities.length === 0 && Hint(gettext("Tap Refresh entities to load them from Home Assistant.")),
      entities.length > 0 && shown.length === 0 && Hint(gettext("No entity matches the filter.")),
      ...rows,

      // Health data sync
      Heading("Health data sync"),
      Select({
        label: gettext("Send health data to"),
        value: mode,
        options: SENSOR_MODES.map((m) => ({ name: gettext(MODE_LABELS[m]), value: m })),
        onChange: (value) => store.setItem(SETTING.SENSOR_MODE, value),
      }),
      ...(mode !== "none"
        ? [
            Select({
              label: gettext("Sync every"),
              value: get(SETTING.SYNC_INTERVAL) || "5",
              options: SYNC_INTERVALS.map((m) => ({ name: `${m} min`, value: String(m) })),
              onChange: (value) => store.setItem(SETTING.SYNC_INTERVAL, value),
            }),
          ]
        : []),
      ...(mode === "zepp2hass"
        ? [
            TextInput({
              label: gettext("zepp2hass webhook URL"),
              value: get(SETTING.ZEPP2HASS_URL),
              subStyle: inputStyle,
              onChange: (raw) => {
                const url = raw.trim()
                saveChecked(store, "zepp2hass", SETTING.ZEPP2HASS_URL, isHttpUrl(url) ? url : null, gettext("Must start with http:// or https://"))
              },
            }),
            errors.zepp2hass && ErrorText(errors.zepp2hass),
          ]
        : []),
      ...(mode === "mobile_app"
        ? [
            Button({
              label: gettext("Register in Home Assistant"),
              style: buttonStyle,
              onClick: () => store.setItem(SETTING.REGISTER_REQUEST, String(Date.now())),
            }),
            Hint(parseJson(get(SETTING.MOBILE_APP), null) ? gettext("Registered in Home Assistant") : gettext("Not registered yet")),
          ]
        : []),
      Text({ style: lastOk || !last ? hintStyle : errorStyle }, lastText),

      // Sleep as Android
      Heading("Sleep as Android"),
      Hint(gettext("Needs the Home Assistant Companion app on the phone and the sleep_as_android integration.")),
      TextInput({
        label: gettext("Notify service"),
        value: get(SETTING.SAA_NOTIFY_SERVICE),
        subStyle: inputStyle,
        onChange: (raw) => {
          const service = normalizeNotifyService(raw)
          saveChecked(store, "saaNotify", SETTING.SAA_NOTIFY_SERVICE, service, gettext("Letters, digits and _ only, e.g. mobile_app_pixel_8"))
        },
      }),
      errors.saaNotify && ErrorText(errors.saaNotify),
      TextInput({
        label: gettext("Status entity"),
        value: get(SETTING.SAA_STATUS_ENTITY),
        subStyle: inputStyle,
        onChange: (raw) => {
          const entity = normalizeStatusEntity(raw)
          saveChecked(store, "saaStatus", SETTING.SAA_STATUS_ENTITY, entity, gettext("Entity id like sensor.sleep_as_android, or empty"))
        },
      }),
      errors.saaStatus && ErrorText(errors.saaStatus),
    ])
  },
})
