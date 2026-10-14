import { router, useLocalSearchParams } from 'expo-router';
import { Share, View } from 'react-native';

import { Screen } from '../components/layout';
import { Button, Icon, Photo, Row, T } from '../components/ui';
import { venueById } from '../data/mock';
import { shortDate, time } from '../lib/format';
import { useEvent } from '../store/useApp';
import { colors } from '../theme';

export default function EventCreated() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const event = useEvent(id);
  if (!event) return null;
  const venue = venueById(event.venueId);
  return (
    <Screen edges={['top', 'bottom']} contentStyle={{ alignItems: 'center', paddingHorizontal: 24, paddingTop: 32, gap: 12 }}>
      <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: colors.brandDeep, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="check" size={50} color={colors.white} />
      </View>
      <T v="h1" color={colors.brandMid} center>Nice!{'\n'}Your event is created!</T>
      <T v="body" color={colors.muted} center>You can now edit or add more information, create a promotion and start inviting guests.</T>
      <T v="h3" color={colors.brandMid} center style={{ marginTop: 8 }}>{event.title}</T>
      <T v="body" center>{shortDate(event.start)} at {time(event.start)}{'\n'}{venue?.name}, Berlin</T>
      <Photo src={event.cover} style={{ width: '100%', height: 200 }} radius={18} />
      <Row gap={12} style={{ alignSelf: 'stretch' }}>
        <Button title="Invite guests" icon="account-plus-outline" style={{ flex: 1 }} size="md" onPress={() => router.push(`/invite?event=${event.id}`)} />
        <Button title="Share event" icon="share-variant-outline" style={{ flex: 1, backgroundColor: '#7A3BC0' }} size="md" onPress={() => Share.share({ message: `Join me at ${event.title} on Domtak` }).catch(() => {})} />
      </Row>
      <Button title="Manage event" variant="secondary" full onPress={() => router.replace(`/pro/attendees/${event.id}`)} />
      <Button title="To Home page" full onPress={() => router.replace('/(tabs)')} />
    </Screen>
  );
}
