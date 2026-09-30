export const EXTENSION_ID = "com.ex-asperis.around-the-table";
export const SCENE_METADATA_KEY = `${EXTENSION_ID}/scene`;
export const PERSPECTIVE_METADATA_KEY = `${EXTENSION_ID}/perspective`;
export const SOURCE_METADATA_KEY = `${EXTENSION_ID}/source`;
export const PROXY_METADATA_KEY = `${EXTENSION_ID}/proxy`;
export const TOOL_ID = `${EXTENSION_ID}/tool`;
export const TOOL_MODE_ID = `${EXTENSION_ID}/move-character`;
export const DEBUG = true;

export const debug = (...values: readonly unknown[]): void => {
  if (DEBUG) console.debug("[AroundTheTable]", ...values);
};

export const reportError = (message: string, cause: unknown): void => {
  console.error(`[AroundTheTable] ${message}`, cause);
};
