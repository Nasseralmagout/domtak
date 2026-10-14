import { Redirect } from 'expo-router';

// The centre "+" tab opens the create sheet instead of rendering a screen.
export default function CreateTab() {
  return <Redirect href="/create-menu" />;
}
