import OBR from "@owlbear-rodeo/sdk";
import { reportError } from "./constants";
import { startRuntime } from "./runtime";

OBR.onReady(() => {
  void startRuntime().catch((cause) => reportError("Background runtime startup failed", cause));
});
