import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { type ReactNode, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';

import { BottomBar, goBack, Screen, ScreenHeader } from '../../components/layout';
import { Button, Card, Chip, Field, Icon, type IconName, IconButton, Photo, Row, Stepper, T, Toggle } from '../../components/ui';
import type { ImgKey } from '../../data/images';
import { OCCASIONS, venueById } from '../../data/mock';
import { euro } from '../../lib/format';
import { toast } from '../../store/toast';
import { useApp, type VenueListing } from '../../store/useApp';
import { colors, fonts, radius } from '../../theme';

const PUBLIC_VENUE_ID = 'moonclub';
const PHOTO_OPTIONS: ImgKey[] = ['ven_neon', 'ven_moon', 'ven_hall', 'ven_loft', 'ven_garden', 'ven_forest', 'ev_club_dark', 'ev_lasers2', 'feed_club', 'feed_rooftop'];
const TYPES: VenueListing['type'][] = ['Club', 'Open air', 'Hall', 'Loft', 'Garden', 'Bar'];
const EQUIPMENT = ['Full equipment', 'Sound & light', 'Sound system', 'Stage only', 'No equipment'];
const DESCRIPTION_MAX = 400;
const PLATFORM_FEE = 0.1;

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      <View style={{ gap: 2 }}>
        <T v="h3">{title}</T>
        {hint ? <T v="small">{hint}</T> : null}
      </View>
      {children}
    </View>
  );
}

function NumberRow({ icon, label, hint, value, onChange, step = 1, min, max }: { icon: IconName; label: string; hint?: string; value: number; onChange: (n: number) => void; step?: number; min: number; max: number }) {
  return (
    <Row gap={12} style={{ minHeight: 56 }}>
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={20} color={colors.brand} />
      </View>
      <View style={{ flex: 1 }}>
        <T v="bodyBold">{label}</T>
        {hint ? <T v="small">{hint}</T> : null}
      </View>
      <Stepper value={value} onChange={onChange} step={step} min={min} max={max} label={label.toLowerCase()} />
    </Row>
  );
}

export default function VenueListingEditor() {
  const { width } = useWindowDimensions();
  const listing = useApp((s) => s.venueListing);
  const updateVenueListing = useApp((s) => s.updateVenueListing);
  const [draft, setDraft] = useState<VenueListing>(listing);
  const [error, setError] = useState<string>();

  const patch = (p: Partial<VenueListing>) => {
    setDraft((d) => ({ ...d, ...p }));
    setError(undefined);
  };
  const dirty = JSON.stringify(draft) !== JSON.stringify(listing);

  const cover = draft.photos[0] ?? 'ven_neon';
  const photoOptions = useMemo(() => Array.from(new Set([...PHOTO_OPTIONS, ...listing.photos])), [listing.photos]);
  const occasionOptions = useMemo(
    () => Array.from(new Set([...OCCASIONS.filter((o) => o !== 'Other'), ...(venueById(PUBLIC_VENUE_ID)?.occasions ?? []), ...listing.occasions, 'Other'])),
    [listing.occasions],
  );
  const tile = Math.floor((width - 32 - 16) / 3);

  const setCover = (k: ImgKey) => patch({ photos: [k, ...draft.photos.filter((x) => x !== k)] });
  const toggleGallery = (k: ImgKey) => {
    if (k === cover) return;
    patch({ photos: draft.photos.includes(k) ? draft.photos.filter((x) => x !== k) : [...draft.photos, k] });
  };
  const toggleOccasion = (o: string) => patch({ occasions: draft.occasions.includes(o) ? draft.occasions.filter((x) => x !== o) : [...draft.occasions, o] });

  const save = () => {
    if (draft.name.trim().length < 2) return setError('Add your venue name');
    if (!draft.area.trim()) return setError('Add the area or district');
    if (draft.pricePerNight <= 0) return setError('Set a price per night');
    if (draft.occasions.length === 0) return setError('Pick at least one occasion');
    setError(undefined);
    updateVenueListing({ ...draft, name: draft.name.trim(), area: draft.area.trim(), description: draft.description.trim() });
    toast('Venue listing saved');
    goBack('/pro/workspace');
  };

  const facts: { icon: IconName; label: string }[] = [
    { icon: 'account-group-outline', label: `${draft.capacity} people` },
    { icon: 'door', label: `${draft.rooms} room${draft.rooms === 1 ? '' : 's'}` },
    { icon: 'speaker', label: `${draft.stages} stage${draft.stages === 1 ? '' : 's'}` },
    ...(draft.parking ? [{ icon: 'parking' as const, label: 'Parking' }] : []),
  ];

  return (
    <Screen
      keyboard
      header={
        <ScreenHeader
          title="My venue listing"
          subtitle={dirty ? 'Unsaved changes' : 'Visible to organizers and fans'}
          onBack={() => goBack('/pro/workspace')}
          right={<IconButton name="open-in-new" label="View public page" color={colors.brand} onPress={() => router.push(`/venue/${PUBLIC_VENUE_ID}`)} />}
        />
      }
      footer={
        <BottomBar>
          {error ? <T v="small" color={colors.danger} style={{ marginBottom: 8 }}>{error}</T> : null}
          <Row gap={10}>
            {dirty ? <Button title="Discard" variant="secondary" style={{ flex: 1 }} onPress={() => { setDraft(listing); setError(undefined); toast('Changes discarded'); }} /> : null}
            <Button title={dirty ? 'Save changes' : 'Save listing'} icon="check" style={{ flex: dirty ? 1.6 : 1 }} full={!dirty} onPress={save} />
          </Row>
        </BottomBar>
      }
    >
      {/* Live preview */}
      <View style={{ gap: 8 }}>
        <Row justify="space-between">
          <T v="caption">LIVE PREVIEW</T>
          <Pressable accessibilityRole="link" onPress={() => router.push(`/venue/${PUBLIC_VENUE_ID}`)} hitSlop={10} style={{ minHeight: 32, justifyContent: 'center' }}>
            <T v="smallBold" color={colors.brand}>View public page</T>
          </Pressable>
        </Row>
        <Card padded={false} style={{ overflow: 'hidden' }}>
          <View style={{ height: 170 }}>
            <Photo src={cover} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} accessibilityLabel="Cover photo" />
            <LinearGradient colors={['transparent', 'rgba(20,10,40,0.85)']} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 100 }} />
            <View style={{ position: 'absolute', top: 12, left: 12, backgroundColor: colors.gold, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
              <Text style={{ fontFamily: fonts.bodyBold, fontSize: 11, color: colors.brandDark }}>{draft.type.toUpperCase()}</Text>
            </View>
            <View style={{ position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Icon name="image-multiple-outline" size={13} color={colors.white} />
              <Text style={{ fontFamily: fonts.bodyBold, fontSize: 11, color: colors.white }}>{draft.photos.length}</Text>
            </View>
            <View style={{ position: 'absolute', left: 16, right: 16, bottom: 12 }}>
              <Text numberOfLines={1} style={{ fontFamily: fonts.display, fontSize: 22, color: colors.white }}>{draft.name.trim() || 'Your venue name'}</Text>
              <Text numberOfLines={1} style={{ fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.lilacLight }}>Berlin, {draft.area.trim() || 'Area'}</Text>
            </View>
          </View>
          <View style={{ padding: 14, gap: 10 }}>
            <Row gap={8} style={{ flexWrap: 'wrap' }}>
              <View style={pillDark}><Text style={pillDarkText}>{euro(draft.pricePerNight)}/Night</Text></View>
              <View style={pillDark}><Text style={pillDarkText}>{draft.equipment}</Text></View>
            </Row>
            <Row gap={14} style={{ flexWrap: 'wrap' }}>
              {facts.map((f) => (
                <Row key={f.label} gap={4}><Icon name={f.icon} size={17} color={colors.brand} /><T v="smallBold" color={colors.inkSoft}>{f.label}</T></Row>
              ))}
            </Row>
            {draft.description.trim() ? <T v="small" numberOfLines={2}>{draft.description.trim()}</T> : null}
            <T v="small" color={colors.brandMid} numberOfLines={1}>
              {draft.occasions.length ? `Great for ${draft.occasions.slice(0, 2).join(', ')}${draft.occasions.length > 2 ? ` +${draft.occasions.length - 2}` : ''}` : 'No occasions picked yet'}
            </T>
          </View>
        </Card>
      </View>

      <Section title="Cover photo" hint="The first photo organizers see in search.">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {photoOptions.map((k, i) => {
            const on = k === cover;
            return (
              <Pressable key={k} accessibilityRole="button" accessibilityLabel={on ? `Photo ${i + 1}, current cover` : `Use photo ${i + 1} as cover`} accessibilityState={{ selected: on }} onPress={() => setCover(k)}>
                <Photo src={k} style={{ width: 96, height: 72, borderRadius: 14, borderWidth: on ? 3 : 0, borderColor: colors.brand }} />
                {on ? (
                  <View style={{ position: 'absolute', left: 6, bottom: 6, backgroundColor: colors.brand, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                    <Text style={{ fontFamily: fonts.bodyBold, fontSize: 10, color: colors.white }}>COVER</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </Section>

      <Section title="Gallery" hint={`${draft.photos.length} photo${draft.photos.length === 1 ? '' : 's'} on your page. Tap to add or remove.`}>
        <Row gap={8} style={{ flexWrap: 'wrap' }}>
          {photoOptions.map((k, i) => {
            const isCover = k === cover;
            const on = draft.photos.includes(k);
            return (
              <Pressable
                key={k}
                accessibilityRole="checkbox"
                accessibilityLabel={isCover ? `Photo ${i + 1}, cover photo, always shown` : `Photo ${i + 1}, ${on ? 'in gallery' : 'not in gallery'}`}
                accessibilityState={{ checked: on, disabled: isCover }}
                onPress={() => toggleGallery(k)}
                style={{ width: tile, height: tile * 0.78 }}
              >
                <Photo src={k} style={{ flex: 1, borderRadius: radius.sm, opacity: on ? 1 : 0.45 }} />
                <View style={{ position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: 12, backgroundColor: on ? colors.brand : 'rgba(255,255,255,0.9)', borderWidth: on ? 0 : 1, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' }}>
                  {on ? <Icon name={isCover ? 'star' : 'check'} size={15} color={colors.white} /> : null}
                </View>
              </Pressable>
            );
          })}
        </Row>
      </Section>

      <Section title="Basics">
        <Field label="Venue name" value={draft.name} onChangeText={(v) => patch({ name: v })} placeholder="e.g. Moon Club" maxLength={40} />
        <Field label="Area / district" value={draft.area} onChangeText={(v) => patch({ area: v })} placeholder="e.g. Kreuzberg" icon="map-marker-outline" maxLength={40} />
        <View style={{ gap: 8 }}>
          <T v="label">Venue type</T>
          <Row gap={8} style={{ flexWrap: 'wrap' }}>
            {TYPES.map((t) => <Chip key={t} label={t} selected={draft.type === t} onPress={() => patch({ type: t })} />)}
          </Row>
        </View>
      </Section>

      <Section title="Space">
        <Card style={{ gap: 6 }}>
          <NumberRow icon="account-group-outline" label="Capacity" hint="Standing guests" value={draft.capacity} step={10} min={10} max={5000} onChange={(n) => patch({ capacity: n })} />
          <NumberRow icon="door" label="Rooms" value={draft.rooms} min={1} max={20} onChange={(n) => patch({ rooms: n })} />
          <NumberRow icon="speaker" label="Stages" value={draft.stages} min={0} max={10} onChange={(n) => patch({ stages: n })} />
          <Row gap={12} style={{ minHeight: 56 }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="parking" size={20} color={colors.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <T v="bodyBold">Parking</T>
              <T v="small">On-site or reserved spots</T>
            </View>
            <Toggle label="Parking available" value={draft.parking} onValueChange={(v) => patch({ parking: v })} />
          </Row>
        </Card>
      </Section>

      <Section title="Price">
        <Field
          label="Price per night (€)"
          value={draft.pricePerNight ? String(draft.pricePerNight) : ''}
          onChangeText={(v) => patch({ pricePerNight: Number(v.replace(/\D/g, '')) || 0 })}
          keyboardType="number-pad"
          placeholder="800"
          icon="currency-eur"
          maxLength={6}
        />
        <T v="small">{draft.pricePerNight > 0 ? `You receive ${euro(draft.pricePerNight * (1 - PLATFORM_FEE))} per night after the 10% Domtak fee.` : 'Organizers see this as your starting price.'}</T>
      </Section>

      <Section title="Equipment">
        <Row gap={8} style={{ flexWrap: 'wrap' }}>
          {EQUIPMENT.map((e) => <Chip key={e} label={e} selected={draft.equipment === e} onPress={() => patch({ equipment: e })} />)}
        </Row>
      </Section>

      <Section title="Occasions" hint={`${draft.occasions.length} selected. Organizers filter venues by these.`}>
        <Row gap={8} style={{ flexWrap: 'wrap' }}>
          {occasionOptions.map((o) => <Chip key={o} label={o} selected={draft.occasions.includes(o)} onPress={() => toggleOccasion(o)} />)}
        </Row>
      </Section>

      <View style={{ gap: 6 }}>
        <Field
          label="Description"
          value={draft.description}
          onChangeText={(v) => patch({ description: v.slice(0, DESCRIPTION_MAX) })}
          multiline
          placeholder="Rooms, sound system, vibe and what makes your venue special"
        />
        <T v="small" style={{ alignSelf: 'flex-end' }}>{draft.description.length} / {DESCRIPTION_MAX}</T>
      </View>
    </Screen>
  );
}

const pillDark = { backgroundColor: colors.brandDark, borderRadius: 14, paddingHorizontal: 12, height: 30, justifyContent: 'center' as const };
const pillDarkText = { color: colors.white, fontFamily: fonts.bodyBold, fontSize: 13 };
