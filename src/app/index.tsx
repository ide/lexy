import { ObserveInteractiveMarker } from "expo-observe";
import { Redirect } from "expo-router";

import { useAuth } from "@/auth/auth-context";

export default function Index() {
  // No loading guard, because there is no loading state: the session is read
  // synchronously before the first render, so this route always mounts with
  // the answer already in hand.
  const { session } = useAuth();
  // `/` must resolve to a real route — without it expo-router shows the
  // built-in "Unmatched Route" screen on launch. The redirect hands off to the
  // tabs (or sign-in); the root stack disables its animation so the target
  // renders in place instead of sliding in from the right.
  //
  // The marker closes out this route's navigation TTI — a redirect is as
  // interactive as `/` ever gets, and without it Observe records a TTR but no
  // TTI for every launch. It must precede the Redirect: sibling effects run in
  // tree order, and markInteractive only records while the route is still
  // focused, so it has to fire before the redirect steals focus.
  return (
    <>
      <ObserveInteractiveMarker />
      <Redirect href={session ? "/(tabs)/status" : "/sign-in"} />
    </>
  );
}
