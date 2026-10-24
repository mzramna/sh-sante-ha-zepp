import { state } from "../state.js";

let next = 1;
export const ONCE = 0, REPEAT_DAY = 1;
export const set = (option) => {
  const id = next++;
  state.alarms.set(id, option);
  return id;
};
export const cancel = (opt) => state.alarms.delete(typeof opt === "number" ? opt : opt.id);
export const getAllAlarms = () => [...state.alarms.keys()];
