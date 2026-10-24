import { state } from "../state.js";

export const showToast = ({ content }) => state.toasts.push(content);
export const GESTURE_UP = 1, GESTURE_DOWN = 2, GESTURE_LEFT = 3, GESTURE_RIGHT = 4;
export const onGesture = () => {};
export const offGesture = () => {};
export const createModal = (opts) => ({ opts, show() {} });
export const onKey = () => {};
export const offKey = () => {};
