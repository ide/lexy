import { ObserveInteractiveMarker } from "expo-observe";
import { Redirect } from "expo-router";

// Any unmatched route (stray deep link, stale path) recovers to `/` — which
// re-runs the auth redirect — instead of stranding the user on the built-in
// Unmatched Route screen (whose Sitemap link can crash release builds).
export default function NotFound() {
  // Same as `/`: the marker closes out this route's navigation TTI, and must
  // precede the Redirect so it fires while the route is still focused.
  return (
    <>
      <ObserveInteractiveMarker />
      <Redirect href="/" />
    </>
  );
}
