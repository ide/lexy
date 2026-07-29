import * as Updates from "expo-updates";

/**
 * Whether on-device developer tools (the Settings > Dev Tools section, the
 * loading-skeleton toggle) should be reachable. True in local dev AND in
 * internal preview builds — which run as release, so `__DEV__` is false — but
 * never in production. `Updates.channel` is set by the EAS build profile
 * ("preview" vs "production") and is null in dev/Expo Go.
 */
export const SHOW_DEV_TOOLS = __DEV__ || Updates.channel === "preview";
