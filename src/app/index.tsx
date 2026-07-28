import { Redirect } from 'expo-router';

import { useAuth } from '@/auth/auth-context';

export default function Index() {
  const { session, isLoading } = useAuth();
  if (isLoading) {
    return null;
  }
  // `/` must resolve to a real route — without it expo-router shows the
  // built-in "Unmatched Route" screen on launch. The redirect hands off to the
  // tabs (or sign-in); the root stack disables its animation so the target
  // renders in place instead of sliding in from the right.
  return <Redirect href={session ? '/(tabs)/status' : '/sign-in'} />;
}
