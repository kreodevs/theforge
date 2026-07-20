import { THEFORGE_PLUGIN_DEFAULT_MAX_BYTES } from "@theforge/shared-types";

/**
 * Configuración del subsistema de plugins (carga + instalación ZIP).
 * Variables: PLUGINS_DIRECTORY, PLUGINS_FAIL_ON_ERROR, PLUGINS_MAX_UPLOAD_BYTES,
 * PLUGINS_REQUIRE_SIGNATURE, PLUGINS_SIGNING_SECRET, LICENSE_PORTAL_URL.
 */
export default () => {
  const directory =
    process.env.PLUGINS_DIRECTORY?.trim() ||
    process.env.THEFORGE_PLUGINS_DIR?.trim() ||
    "";

  return {
    plugins: {
      directory,
      failOnPluginError: process.env.PLUGINS_FAIL_ON_ERROR === "true",
      maxUploadBytes: parseInt(
        process.env.PLUGINS_MAX_UPLOAD_BYTES ??
          String(THEFORGE_PLUGIN_DEFAULT_MAX_BYTES),
        10,
      ),
      requireSignature: process.env.PLUGINS_REQUIRE_SIGNATURE === "true",
      signingSecret: process.env.PLUGINS_SIGNING_SECRET?.trim() || "",
      licensePortalUrl:
        process.env.LICENSE_PORTAL_URL?.trim() ||
        "https://licenses.theforge.dev/api/v1",
    },
  };
};
