import * as Linking from "expo-linking";

import { haptic } from "@/utils/haptics";

// The Lexus OneApp App Store entry (iOS app com.lexus.oneApp). Hard fallback if
// the universal link below can't be opened at all.
export const LEXUS_APP_STORE_URL = "https://apps.apple.com/us/app/lexus/id1468484450";

// The Lexus app's associated domain. Confirmed from the app's
// apple-app-site-association at ctlexusapp.com, which claims all paths for
// appIDs FEL7N4H72G.com.lexus.oneApp / com.lexus.OneAppEnterprise. Opening a URL
// on it launches the installed app directly; ctlexusapp.com is a Branch-hosted
// domain, so when the app isn't installed it redirects to the App Store — one
// URL covers both cases without guessing a custom scheme. An empty/unrecognized
// path lands on the app's home; a recognized one (e.g. "/shop") deep-links that
// tab on a best-effort basis.
const LEXUS_APP_ORIGIN = "https://ctlexusapp.com";

/**
 * Open the Lexus app if it's installed, otherwise (via the Branch domain's
 * redirect) its App Store page. Pass `path` to best-effort deep-link a tab
 * (e.g. "/shop" for subscriptions); omit it to land on the app's home.
 */
export async function openLexusApp(path = "") {
  haptic("impact-light");
  try {
    await Linking.openURL(`${LEXUS_APP_ORIGIN}${path}`);
  } catch {
    await Linking.openURL(LEXUS_APP_STORE_URL);
  }
}
