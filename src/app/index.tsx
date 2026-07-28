import { Redirect } from 'expo-router';

import { useAuth } from '@/auth/auth-context';

export default function Index() {
  const { session, isLoading } = useAuth();
  if (isLoading) {
    return null;
  }
  return <Redirect href={session ? '/(tabs)/status' : '/sign-in'} />;
}
