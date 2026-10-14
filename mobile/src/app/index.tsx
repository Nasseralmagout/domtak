import { Redirect } from 'expo-router';

import { useApp } from '../store/useApp';

export default function Entry() {
  const onboarded = useApp((s) => s.onboarded);
  const authed = useApp((s) => s.authed);
  if (authed) return <Redirect href="/(tabs)" />;
  if (onboarded) return <Redirect href="/login" />;
  return <Redirect href="/onboarding" />;
}
