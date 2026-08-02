import { Redirect } from "expo-router";

import { useLaunchGate } from "@/navigation/use-launch-gate";

export default function Index() {
  // No loading guard: RootNavigator returns null for the whole stack until the
  // launch gate opens, so this route can only mount once there is an answer.
  // Reading that same gate is what keeps this redirect and the stack's own
  // `Stack.Protected` guards from disagreeing — on a launch that renders the
  // cached car before the Keychain has confirmed it, both have to presume the
  // same thing.
  const { signedIn } = useLaunchGate();
  // `/` must resolve to a real route — without it expo-router shows the
  // built-in "Unmatched Route" screen on launch. The redirect hands off to the
  // tabs (or sign-in); the root stack disables its animation so the target
  // renders in place instead of sliding in from the right.
  return <Redirect href={signedIn ? "/(tabs)/status" : "/sign-in"} />;
}
