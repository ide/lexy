import { Redirect } from "expo-router";

import { useAuth } from "@/auth/auth-context";

export default function Index() {
  // No isLoading guard: RootNavigator returns null for the whole stack while
  // auth is restoring, so this route can only mount with auth settled.
  const { session } = useAuth();
  // `/` must resolve to a real route — without it expo-router shows the
  // built-in "Unmatched Route" screen on launch. The redirect hands off to the
  // tabs (or sign-in); the root stack disables its animation so the target
  // renders in place instead of sliding in from the right.
  return <Redirect href={session ? "/(tabs)/status" : "/sign-in"} />;
}
