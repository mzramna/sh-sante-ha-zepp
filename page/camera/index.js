import { BasePage } from "@zeppos/zml/base-page";
import * as hmUI from "@zos/ui";
import { getText } from "@zos/i18n";
import { METHOD } from "../../shared/protocol.js";
import { FEATURES } from "../../config/build.js";
import { CX, TOP, COLOR } from "../../utils/theme.js";
import { clear, createTracked, title, message, actionButton } from "../../utils/ui.js";

// Image box (360x270 on screen) and the snapshot size requested from HA.
const SHOW = { x: CX - 180, y: TOP + 16, w: 360, h: 270 };
const REQUEST = { width: 400, height: 300 };

Page(
  BasePage({
    state: { entityId: "", name: "", widgets: [] },

    onInit(params) {
      this.state.entityId = JSON.parse(params || "{}").entity_id;
      this.state.name = this.state.entityId;
    },

    build() {
      if (!FEATURES.camera) {
        message(this.state.widgets, getText("camera_disabled"));
        return;
      }
      // Title falls back to the entity id if the lookup fails.
      this.request({ method: METHOD.GET_ENTITY, params: { entity_id: this.state.entityId } })
        .then((entity) => {
          this.state.name = entity.name;
        })
        .catch(() => {})
        .then(() => this.refresh());
    },

    // On success the request only confirms the snapshot was queued; the image arrives in onReceivedFile.
    refresh() {
      this.showState(getText("loading"));
      this.request({ method: METHOD.CAMERA_SNAPSHOT, params: { entity_id: this.state.entityId, ...REQUEST } }).catch(
        (e) => this.showState(String(e))
      );
    },

    showState(text) {
      clear(this.state.widgets);
      title(this.state.widgets, this.state.name);
      message(this.state.widgets, text, COLOR.textDim);
      this.refreshButton();
    },

    refreshButton() {
      actionButton(this.state.widgets, {
        x: CX - 80, y: 380, w: 160, h: 72, text: getText("camera_refresh"), onClick: () => this.refresh(),
      });
    },

    onReceivedFile(file) {
      if (!file.params || file.params.type !== "image") return;
      // filePath is only valid once the transfer has finished.
      file.on("change", (e) => {
        if (e.data.readyState !== "transferred") return;
        clear(this.state.widgets);
        title(this.state.widgets, this.state.name);
        createTracked(this.state.widgets, hmUI.widget.IMG, { ...SHOW, src: file.filePath });
        this.refreshButton();
      });
    },
  })
);
