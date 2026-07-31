import { Redirect } from "expo-router";

// Any unmatched route (stray deep link, stale path) recovers to `/` — which
// re-runs the auth redirect — instead of stranding the user on the built-in
// Unmatched Route screen (whose Sitemap link can crash release builds).
export default function NotFound() {
  return <Redirect href="/" />;
}
