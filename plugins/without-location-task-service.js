const { withAndroidManifest } = require("expo/config-plugins");

const SERVICE = "expo.modules.location.services.LocationTaskService";

/**
 * expo-location's manifest declares a background-location foreground service.
 * Lexy never starts it — the module's only caller is `useParkingAddress`, which
 * reverse-geocodes coordinates the app already has — but a service typed
 * `location` is the declaration Play review reads hardest, so remove it instead
 * of explaining it. The entry has to be added here rather than filtered out:
 * the service arrives during manifest merging, and `tools:node="remove"` is what
 * tells the merger to drop a node the app itself never wrote.
 */
module.exports = function withoutLocationTaskService(config) {
  return withAndroidManifest(config, (mod) => {
    const application = mod.modResults.manifest.application?.[0];
    if (!application) {
      throw new Error("Expected an <application> node in the Android manifest");
    }
    application.service = [
      ...(application.service ?? []).filter(
        (service) => service.$["android:name"] !== SERVICE,
      ),
      { $: { "android:name": SERVICE, "tools:node": "remove" } },
    ];
    return mod;
  });
};
