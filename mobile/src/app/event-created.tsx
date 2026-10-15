import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, Share, View } from 'react-native';

import { Screen, ScreenHeader } from '../components/layout';
import { Button, EmptyState, Icon, Photo, Row, T } from '../components/ui';
import { venueById } from '../data/mock';
import { shortDate, time } from '../lib/format';
import { useEvent } from '../store/useApp';
import { colors, radius, shadow } from '../theme';

export default function EventCreated() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const event = useEvent(id);

  if (!event) {
    return (
      <Screen header={<ScreenHeader title="Event" onBack={() => router.replace('/(tabs)')} />}>
        <EmptyState icon="calendar-remove-outline" title="Event not found" body="We could not find this event. You can create a new one from the plus button." action="Create event" onAction={() => router.replace('/create-event')} />
      </Screen>
    );
  }

  const venue = venueById(event.venueId);
  return (
    <Screen edges={['top', 'bottom']} contentStyle={{ alignItems: 'center', paddingHorizontal: 24, paddingTop: 32, gap: 12 }}>
      <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: colors.brandDeep, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="check" size={50} color={colors.white} />
      </View>
      <T v="h1" color={colors.brandMid} center>Nice!{'\n'}Your event is created!</T>
      <T v="body" color={colors.muted} center>You can now edit or add more information, create a promotion and start inviting guests.</T>
      <T v="h3" color={colors.brandMid} center style={{ marginTop: 8 }}>{event.title}</T>
      <T v="body" center>{shortDate(event.start)} at {time(event.start)}{'\n'}{venue?.name ?? 'Venue to be announced'}, Berlin</T>
      <Photo src={event.cover} style={{ width: '100%', height: 200 }} radius={18} accessibilityLabel={`${event.title} cover`} />
      <Row gap={12} style={{ alignSelf: 'stretch' }}>
        <Button title="Invite guests" icon="account-plus-outline" style={{ flex: 1 }} size="md" onPress={() => router.push(`/invite?event=${event.id}`)} />
        <Button title="Share event" icon="share-variant-outline" style={{ flex: 1, backgroundColor: colors.brandMid }} size="md" onPress={() => Share.share({ message: `Join me at ${event.title} on Domtak` }).catch(() => {})} />
      </Row>

      {!event.isPrivate ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Promote event. Featured in Discover, Map and Search from 49 euros a week"
          onPress={() => router.push(`/pro/promote/${event.id}`)}
          style={({ pressed }) => ({
            alignSelf: 'stretch',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            minHeight: 64,
            padding: 14,
            borderRadius: radius.lg,
            backgroundColor: colors.brandDeep,
            opacity: pressed ? 0.9 : 1,
            ...shadow(1),
          })}
        >
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="rocket-launch-outline" size={22} color={colors.gold} />
          </View>
          <View style={{ flex: 1 }}>
            <T v="bodyBold" color={colors.white}>Promote event</T>
            <T v="small" color={colors.lilacLight}>Featured in Discover, Map and Search from €49 / week</T>
          </View>
          <Icon name="chevron-right" size={22} color={colors.lilacLight} />
        </Pressable>
      ) : null}

      <Row gap={12} style={{ alignSelf: 'stretch' }}>
        <Button title="Edit event" icon="pencil-outline" variant="secondary" size="md" style={{ flex: 1 }} onPress={() => router.push({ pathname: '/create-event', params: { edit: event.id } })} />
        <Button title="Manage" icon="account-group-outline" variant="secondary" size="md" style={{ flex: 1 }} onPress={() => router.replace(`/pro/attendees/${event.id}`)} />
      </Row>
      <Button title="To Home page" full onPress={() => router.replace('/(tabs)')} />
    </Screen>
  );
}
