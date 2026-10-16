import { Redirect } from 'expo-router';

import { useApp } from '../store/useApp';

/**
 * Older links (notifications, action queue, permission notices) open this route.
 * Professional status has one source of truth: the application status screen,
 * or the application form when there is no application yet.
 */
export default function ProVerification() {
  const hasApplication = useApp((s) => !!s.user.application);
  return <Redirect href={hasApplication ? '/application' : '/apply'} />;
}
