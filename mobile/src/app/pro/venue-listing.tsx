import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { type ReactNode, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';

import { VenueFacts, venuePriceLabel } from '../../components/cards';
import { BottomBar, goBack, PermissionNotice, Screen, ScreenHeader } from '../../components/layout';
import { Banner, Button, Card, Checklist, Chip, Field, Icon, type IconName, IconButton, LineItems, Photo, Row, Segmented, Stepper, T, Toggle } from '../../components/ui';
import type { ImgKey } from '../../data/images';
import { OCCASIONS, PARKING_KIND_LABEL, venueById } from '../../data/mock';
import type { ExtraCharge, PricingMode, VenueCatering, VenueGarden, VenueParking, VenueSecurity } from '../../data/types';
import { isConfirmed } from '../../lib/booking';
import { euro, plural } from '../../lib/format';
import { cateringCost, guardsFor, PLATFORM_COMMISSION_RATE, providerNet, securityCost, toLineItems, venueEstimate } from '../../lib/pricing';
import { useServices, useServicesHydrated } from '../../store/services';
import { toast } from '../../store/toast';
import { activeWorkspace, OWN_VENUE_ID, overlayVenue, useApp, type VenueListing } from '../../store/useApp';
import { colors, fonts, radius } from '../../theme';

/** Your public venue page (/venue/moonclub) shows the published listing. */
const PUBLIC_VENUE_ID = OWN_VENUE_ID;
const PHOTO_OPTIONS: ImgKey[] = ['ven_neon', 'ven_moon', 'ven_hall', 'ven_loft', 'ven_garden', 'ven_forest', 'ev_club_dark', 'ev_lasers2', 'feed_club', 'feed_rooftop'];
const TYPES: VenueListing['type'][] = ['Club', 'Open air', 'Hall', 'Loft', 'Garden', 'Bar'];
const EQUIPMENT = ['Full equipment', 'Sound & light', 'Sound system', 'Stage only', 'No equipment'];
const PARKING_KINDS = Object.keys(PARKING_KIND_LABEL) as NonNullable<VenueParking['kind']>[];
const FACILITY_SUGGESTIONS = ['Green room', 'Cloakroom', 'Bar', 'Kitchen', 'Dance floor', 'Step-free entrance', 'Lift', 'Toilets', 'Stage lights', 'Projector', 'Seating', 'Heaters'];
const REQUIREMENT_SUGGESTIONS = ['Guests 18+', 'Curfew 23:00', 'Quiet after 22:00', 'Damage deposit', 'No confetti or open flames', 'Fire safety briefing', 'Bad-weather plan required'];
const DESCRIPTION_MAX = 400;
const DESCRIPTION_MIN = 40;

const num = (v: string) => Number(v.replace(/\D/g, '')) || 0;

function Section({ title, hint, icon, children }: { title: string; hint?: string; icon?: IconName; children: ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      <View style={{ gap: 2 }}>
        <Row gap={8}>
          {icon ? <Icon name={icon} size={20} color={colors.brandDeep} /> : null}
          <T v="h3" accessibilityRole="header">{title}</T>
        </Row>
        {hint ? <T v="small">{hint}</T> : null}
      </View>
      {children}
    </View>
  );
}

function IconBox({ icon, on = true }: { icon: IconName; on?: boolean }) {
  return (
    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: on ? colors.brandSoft : colors.chipIdle, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={20} color={on ? colors.brand : colors.disabled} />
    </View>
  );
}

function NumberRow({ icon, label, hint, value, onChange, step = 1, min, max }: { icon: IconName; label: string; hint?: string; value: number; onChange: (n: number) => void; step?: number; min: number; max: number }) {
  return (
    <Row gap={12} style={{ minHeight: 56 }}>
      <IconBox icon={icon} />
      <View style={{ flex: 1 }}>
        <T v="bodyBold">{label}</T>
        {hint ? <T v="small">{hint}</T> : null}
      </View>
      <Stepper value={value} onChange={onChange} step={step} min={min} max={max} label={label.toLowerCase()} />
    </Row>
  );
}

function ToggleRow({ icon, label, hint, value, onChange }: { icon: IconName; label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Row gap={12} style={{ minHeight: 56 }}>
      <IconBox icon={icon} on={value} />
      <View style={{ flex: 1 }}>
        <T v="bodyBold">{label}</T>
        {hint ? <T v="small">{hint}</T> : null}
      </View>
      <Toggle label={label} value={value} onValueChange={onChange} />
    </Row>
  );
}

/** Editable list (facilities, requirements) with quick-add suggestions. */
function ListEditor({ items, onChange, suggestions, placeholder, label, icon, empty }: { items: string[]; onChange: (v: string[]) => void; suggestions: string[]; placeholder: string; label: string; icon: IconName; empty: string }) {
  const [text, setText] = useState('');
  const add = (v: string) => {
    const t = v.trim();
    setText('');
    if (!t || items.some((x) => x.toLowerCase() === t.toLowerCase())) return;
    onChange([...items, t]);
  };
  const left = suggestions.filter((s) => !items.includes(s)).slice(0, 6);
  return (
    <Card style={{ gap: 10 }}>
      {items.length ? (
        items.map((i) => (
          <Row key={i} gap={10}>
            <Icon name={icon} size={18} color={colors.brand} />
            <T v="body" style={{ flex: 1 }}>{i}</T>
            <IconButton name="close" label={`Remove ${i}`} size={36} iconSize={18} color={colors.muted} onPress={() => onChange(items.filter((x) => x !== i))} />
          </Row>
        ))
      ) : (
        <T v="small">{empty}</T>
      )}
      <Field
        accessibilityLabel={label}
        value={text}
        onChangeText={setText}
        placeholder={placeholder}
        maxLength={60}
        returnKeyType="done"
        onSubmitEditing={() => add(text)}
        right={<Button title="Add" size="sm" disabled={!text.trim()} accessibilityLabel={`Add ${text.trim() || label.toLowerCase()}`} onPress={() => add(text)} />}
      />
      {left.length ? (
        <Row gap={8} style={{ flexWrap: 'wrap' }}>
          {left.map((s) => <Chip key={s} label={s} icon="plus" accessibilityLabel={`Add ${s}`} onPress={() => add(s)} />)}
        </Row>
      ) : null}
    </Card>
  );
}

/** Separate charges (sound engineer, cleaning…). */
function ChargesEditor({ items, onChange }: { items: ExtraCharge[]; onChange: (v: ExtraCharge[]) => void }) {
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const canAdd = label.trim().length >= 2 && num(amount) > 0 && !items.some((x) => x.label.toLowerCase() === label.trim().toLowerCase());
  const add = () => {
    if (!canAdd) return;
    onChange([...items, { label: label.trim(), amount: num(amount) }]);
    setLabel('');
    setAmount('');
  };
  return (
    <Card style={{ gap: 10 }}>
      {items.length ? (
        items.map((x) => (
          <Row key={x.label} gap={10}>
            <Icon name="receipt-text-outline" size={18} color={colors.brand} />
            <T v="body" style={{ flex: 1 }}>{x.label}</T>
            <T v="bodyBold">{euro(x.amount)}</T>
            <IconButton name="close" label={`Remove ${x.label}`} size={36} iconSize={18} color={colors.muted} onPress={() => onChange(items.filter((y) => y.label !== x.label))} />
          </Row>
        ))
      ) : (
        <T v="small">No separate charges. Add equipment, cleaning or staff charges hosts should know about.</T>
      )}
      <Row gap={8} align="flex-end">
        <Field label="Charge" value={label} onChangeText={setLabel} placeholder="e.g. Sound engineer" maxLength={40} style={{ flex: 1.6 }} />
        <Field label="Amount (€)" value={amount} onChangeText={(v) => setAmount(v.replace(/\D/g, '').slice(0, 5))} keyboardType="number-pad" placeholder="150" style={{ flex: 1 }} />
      </Row>
      <Button title="Add charge" icon="plus" size="md" variant="secondary" disabled={!canAdd} onPress={add} />
    </Card>
  );
}

export default function VenueListingScreen() {
  const user = useApp((s) => s.user);
  const hydrated = useServicesHydrated();
  if (activeWorkspace(user) !== 'venue') {
    return (
      <Screen header={<ScreenHeader title="My venue listing" onBack={() => goBack('/pro/workspace')} />}>
        <PermissionNotice role="venue" action="edit a venue listing" />
      </Screen>
    );
  }
  // The editor starts from your saved draft, so wait until it is loaded.
  if (!hydrated) return <Screen header={<ScreenHeader title="My venue listing" onBack={() => goBack('/pro/workspace')} />}>{null}</Screen>;
  return <VenueListingEditor />;
}

function VenueListingEditor() {
  const { width } = useWindowDimensions();
  const listing = useApp((s) => s.venueListing);
  const bookings = useApp((s) => s.bookings);
  const requests = useApp((s) => s.requests);
  const updateVenueListing = useApp((s) => s.updateVenueListing);
  const savedDraft = useServices((s) => s.venueDraft);
  const saveVenueDraft = useServices((s) => s.saveVenueDraft);
  const discardVenueDraft = useServices((s) => s.discardVenueDraft);
  const [draft, setDraft] = useState<VenueListing>(savedDraft ?? listing);
  const [exampleGuests, setExampleGuests] = useState<number>();

  const patch = (p: Partial<VenueListing>) => setDraft((d) => ({ ...d, ...p }));

  const cover = draft.photos[0] ?? 'ven_neon';
  const photoOptions = useMemo(() => Array.from(new Set([...PHOTO_OPTIONS, ...listing.photos])), [listing.photos]);
  const occasionOptions = useMemo(
    () => Array.from(new Set([...OCCASIONS.filter((o) => o !== 'Other'), ...(venueById(PUBLIC_VENUE_ID)?.occasions ?? []), ...listing.occasions, 'Other'])),
    [listing.occasions],
  );
  // The public venue as guests would see it with this draft applied.
  const preview = useMemo(() => {
    const base = venueById(PUBLIC_VENUE_ID);
    return base ? overlayVenue(base, draft) : undefined;
  }, [draft]);

  const tile = Math.floor((width - 32 - 16) / 3);
  const live = JSON.stringify(listing);
  const current = JSON.stringify(draft);
  const differsFromLive = current !== live;
  const unsaved = current !== JSON.stringify(savedDraft ?? listing);

  const parking: VenueParking = { ...draft.parkingDetails, available: draft.parking };
  const garden: VenueGarden = draft.garden ?? { available: false };
  const catering: VenueCatering = draft.catering ?? { available: false, pricePerGuest: 0 };
  const security: VenueSecurity = draft.security ?? { available: false, guestsPerGuard: 75, pricePerGuard: 0 };
  const facilities = draft.facilities ?? [];
  const requirements = draft.requirements ?? [];
  const extraCharges = draft.extraCharges ?? [];
  const pricing: PricingMode = draft.pricing ?? 'listed';

  const setParking = (p: Partial<VenueParking>) => {
    const available = p.available ?? draft.parking;
    patch({ parking: available, parkingDetails: { ...parking, ...p, available } });
  };
  const setGarden = (p: Partial<VenueGarden>) => patch({ garden: { ...garden, ...p } });
  const setCatering = (p: Partial<VenueCatering>) => patch({ catering: { ...catering, ...p } });
  const setSecurity = (p: Partial<VenueSecurity>) => patch({ security: { ...security, ...p } });

  const setCover = (k: ImgKey) => patch({ photos: [k, ...draft.photos.filter((x) => x !== k)] });
  const toggleGallery = (k: ImgKey) => {
    if (k === cover) return;
    patch({ photos: draft.photos.includes(k) ? draft.photos.filter((x) => x !== k) : [...draft.photos, k] });
  };
  const toggleOccasion = (o: string) => patch({ occasions: draft.occasions.includes(o) ? draft.occasions.filter((x) => x !== o) : [...draft.occasions, o] });

  // Completion checklist (F06): an incomplete listing stays a draft.
  const checklist = [
    { label: 'Venue name and area', done: draft.name.trim().length >= 2 && !!draft.area.trim(), hint: 'Add your venue name and district.' },
    { label: 'Cover photo and 2 more photos', done: draft.photos.length >= 3, hint: `${draft.photos.length} of 3 photos so far.` },
    { label: 'Description', done: draft.description.trim().length >= DESCRIPTION_MIN, hint: `At least ${DESCRIPTION_MIN} characters about the space.` },
    { label: pricing === 'quote' ? 'Quote-based pricing' : 'Price per night', done: pricing === 'quote' || draft.pricePerNight > 0, hint: 'Set a price per night or switch to quote on request.' },
    { label: 'Parking details', done: parking.available ? !!parking.kind : true, hint: 'Choose the kind of parking.' },
    { label: 'Garden or outdoor space', done: garden.available ? (garden.capacity ?? 0) > 0 : true, hint: 'Add how many guests the outdoor space holds.' },
    { label: 'Facilities', done: facilities.length > 0, hint: 'Add at least one facility.' },
    { label: 'Requirements', done: requirements.length > 0, hint: 'Add your house rules, such as curfew or age limit.' },
    { label: 'Occasions', done: draft.occasions.length > 0, hint: 'Pick at least one occasion.' },
    { label: 'Catering prices', done: catering.available ? catering.pricePerGuest > 0 : true, hint: 'Set the price per guest or switch catering off.' },
    { label: 'Security prices', done: security.available ? security.pricePerGuard > 0 && security.guestsPerGuard > 0 : true, hint: 'Set the price per guard or switch security off.' },
  ];
  const missing = checklist.filter((c) => !c.done).length;
  const complete = missing === 0;

  // F07: a change never rewrites agreed terms. Count the work that keeps its old terms.
  const agreed = bookings.filter((b) => b.targetId === PUBLIC_VENUE_ID && isConfirmed(b.status)).length + requests.filter((r) => r.kind === 'venue' && r.status === 'accepted').length;
  const pricesChanged =
    draft.pricePerNight !== listing.pricePerNight ||
    pricing !== (listing.pricing ?? 'listed') ||
    JSON.stringify(draft.catering) !== JSON.stringify(listing.catering) ||
    JSON.stringify(draft.security) !== JSON.stringify(listing.security) ||
    JSON.stringify(draft.extraCharges) !== JSON.stringify(listing.extraCharges);

  // F07: warn when a change conflicts with work you already accepted (it keeps its agreed terms).
  const capacityConflicts = requests.filter((r) => r.kind === 'venue' && r.status === 'accepted' && r.guests > draft.capacity);

  const guests = Math.min(draft.capacity, exampleGuests ?? Math.min(120, draft.capacity));
  const estimate = preview ? venueEstimate(preview, { guests, catering: catering.available, security: security.available }) : undefined;

  const clean = (): VenueListing => ({
    ...draft,
    name: draft.name.trim(),
    area: draft.area.trim(),
    description: draft.description.trim(),
    parkingDetails: { ...parking, notes: parking.notes?.trim() || undefined },
    garden: { ...garden, notes: garden.notes?.trim() || undefined },
  });
  const saveDraft = () => {
    saveVenueDraft(draft);
    toast('Draft saved. Guests still see your published listing.');
  };
  const publish = () => {
    if (!complete) return;
    updateVenueListing(clean());
    discardVenueDraft();
    toast('Published. New requests use these details; accepted bookings keep their agreed terms.');
    goBack('/pro/workspace');
  };
  const discard = () => {
    setDraft(listing);
    discardVenueDraft();
    toast('Draft discarded');
  };
  const leave = () => {
    // Keep unsaved work as a draft instead of losing it.
    if (unsaved && differsFromLive) {
      saveVenueDraft(draft);
      toast('Draft saved. It is not live until you publish.');
    } else if (!differsFromLive && savedDraft) {
      // Edited back to the published version: a leftover draft would only show stale changes.
      discardVenueDraft();
    }
    goBack('/pro/workspace');
  };
  const viewPublic = () => {
    if (differsFromLive) toast('Your public page shows the published listing. Publish to show these changes.');
    router.push(`/venue/${PUBLIC_VENUE_ID}`);
  };

  const status = !differsFromLive ? 'Published · live on your venue page' : unsaved ? 'Unsaved changes · not live' : 'Draft saved · not live';

  return (
    <Screen
      keyboard
      header={
        <ScreenHeader
          title="My venue listing"
          subtitle={status}
          onBack={leave}
          right={<IconButton name="open-in-new" label="View public page" color={colors.brand} onPress={viewPublic} />}
        />
      }
      footer={
        <BottomBar>
          {differsFromLive ? (
            <View style={{ gap: 8 }}>
              <T v="small" color={complete ? colors.muted : colors.warning}>
                {complete ? 'Ready to publish. New requests will use these details.' : `Complete ${plural(missing, 'more item')} to publish. Your public page keeps the published version.`}
              </T>
              <Row gap={10}>
                <Button title={unsaved ? 'Save draft' : 'Draft saved'} variant="secondary" icon="content-save-outline" disabled={!unsaved} style={{ flex: 1 }} onPress={saveDraft} />
                <Button title="Publish" icon="check" disabled={!complete} style={{ flex: 1.2 }} accessibilityLabel={complete ? 'Publish your listing' : `Publish, ${plural(missing, 'item')} missing`} onPress={publish} />
              </Row>
              <Button title="Discard changes" variant="ghost" size="sm" onPress={discard} />
            </View>
          ) : (
            <Button title="Done" icon="check" full onPress={leave} />
          )}
        </BottomBar>
      }
    >
      {/* Live preview */}
      <View style={{ gap: 8 }}>
        <Row justify="space-between">
          <T v="caption">{differsFromLive ? 'PREVIEW · NOT PUBLISHED' : 'PREVIEW · LIVE'}</T>
          <Pressable accessibilityRole="link" accessibilityLabel="View public page" onPress={viewPublic} hitSlop={10} style={{ minHeight: 32, justifyContent: 'center' }}>
            <T v="smallBold" color={colors.brand}>View public page</T>
          </Pressable>
        </Row>
        <Card padded={false} style={{ overflow: 'hidden' }}>
          <View style={{ height: 160 }}>
            <Photo src={cover} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} accessibilityLabel="Cover photo" />
            <LinearGradient colors={['transparent', 'rgba(20,10,40,0.85)']} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 100 }} />
            <View style={{ position: 'absolute', top: 12, left: 12, backgroundColor: colors.gold, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
              <Text style={{ fontFamily: fonts.bodyBold, fontSize: 11, color: colors.brandDark }}>{draft.type.toUpperCase()}</Text>
            </View>
            <View style={{ position: 'absolute', left: 16, right: 16, bottom: 12 }}>
              <Text numberOfLines={1} style={{ fontFamily: fonts.display, fontSize: 22, color: colors.white }}>{draft.name.trim() || 'Your venue name'}</Text>
              <Text numberOfLines={1} style={{ fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.lilacLight }}>Berlin, {draft.area.trim() || 'Area'}</Text>
            </View>
          </View>
          <View style={{ padding: 14, gap: 10 }}>
            <Row gap={8} style={{ flexWrap: 'wrap' }}>
              <View style={pillDark}><Text style={pillDarkText}>{venuePriceLabel({ pricing, pricePerNight: draft.pricePerNight })}</Text></View>
              <View style={pillDark}><Text style={pillDarkText}>{draft.equipment}</Text></View>
            </Row>
            {preview ? <VenueFacts venue={preview} /> : null}
          </View>
        </Card>
      </View>

      <Card style={{ gap: 4 }}>
        <Checklist title="Listing readiness" items={checklist} />
        <T v="small" style={{ marginTop: 6 }}>{complete ? 'Everything hosts need is filled in.' : 'An incomplete listing stays a draft. Guests see your last published version.'}</T>
      </Card>

      <Banner icon="shield-alert-outline" tone={pricesChanged ? 'warning' : 'brand'}>
        {`Changes apply to new requests only. Accepted and confirmed bookings keep the price and terms agreed at the time${agreed ? ` (${plural(agreed, 'booking')} right now)` : ''}. A date that looks free in your calendar still needs your acceptance.`}
      </Banner>

      {capacityConflicts.length ? (
        <Banner icon="alert-outline" tone="warning">
          {`The new capacity (${draft.capacity}) is below ${plural(capacityConflicts.length, 'accepted booking')}: ${capacityConflicts.map((r) => `${r.title}, ${r.guests} guests`).join('; ')}. Those bookings keep their agreed terms, so talk to the host before the date.`}
        </Banner>
      ) : null}

      <Section title="Cover photo" hint="The first photo hosts see in search.">
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

      <Section title="Gallery" hint={`${plural(draft.photos.length, 'photo')} on your page. Tap to add or remove.`}>
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

      <Section title="Space" icon="account-group-outline">
        <Card style={{ gap: 6 }}>
          <NumberRow icon="account-group-outline" label="Capacity" hint="Guests at most" value={draft.capacity} step={10} min={10} max={5000} onChange={(n) => patch({ capacity: n })} />
          <NumberRow icon="door" label="Rooms" value={draft.rooms} min={1} max={20} onChange={(n) => patch({ rooms: n })} />
          <NumberRow icon="speaker" label="Stages" value={draft.stages} min={0} max={10} onChange={(n) => patch({ stages: n })} />
        </Card>
      </Section>

      <Section title="Parking" icon="parking" hint="Its own item on your page, separate from any garden or outdoor space.">
        <Card style={{ gap: 10 }}>
          <ToggleRow icon="parking" label="Parking available" hint={parking.available ? 'Guests can park at or near the venue' : 'No parking for guests'} value={parking.available} onChange={(v) => setParking({ available: v, kind: v ? parking.kind ?? 'on-site' : parking.kind })} />
          {parking.available ? (
            <>
              <View style={{ gap: 8 }}>
                <T v="label">Kind of parking</T>
                <Row gap={8} style={{ flexWrap: 'wrap' }}>
                  {PARKING_KINDS.map((k) => <Chip key={k} label={PARKING_KIND_LABEL[k]} selected={parking.kind === k} onPress={() => setParking({ kind: k })} />)}
                </Row>
              </View>
              <NumberRow icon="car-outline" label="Spaces" hint={parking.spaces ? undefined : 'Leave at 0 if you don’t know'} value={parking.spaces ?? 0} min={0} max={500} onChange={(n) => setParking({ spaces: n || undefined })} />
            </>
          ) : null}
          <Field
            label={parking.available ? 'Parking notes' : 'How guests can arrive instead'}
            value={parking.notes ?? ''}
            onChangeText={(v) => setParking({ notes: v })}
            placeholder={parking.available ? 'e.g. Courtyard spaces, reserve with your booking' : 'e.g. S-Bahn station 5 minutes away'}
            maxLength={120}
          />
        </Card>
      </Section>

      <Section title="Garden and outdoor space" icon="tree-outline" hint="A separate item from parking: terrace, garden, courtyard or clearing.">
        <Card style={{ gap: 10 }}>
          <ToggleRow icon="tree-outline" label="Outdoor space" hint={garden.available ? 'Guests can use a garden or terrace' : 'All space is indoors'} value={garden.available} onChange={(v) => setGarden({ available: v, capacity: v ? garden.capacity ?? Math.min(100, draft.capacity) : garden.capacity })} />
          {garden.available ? (
            <>
              <NumberRow icon="account-group-outline" label="Outdoor capacity" hint="Guests outside at once" value={garden.capacity ?? 0} step={10} min={0} max={5000} onChange={(n) => setGarden({ capacity: n })} />
              <ToggleRow icon="umbrella-outline" label="Covered" hint={garden.covered ? 'Roof, pergola or tent' : 'Open air'} value={!!garden.covered} onChange={(v) => setGarden({ covered: v })} />
              <Field label="Outdoor notes" value={garden.notes ?? ''} onChangeText={(v) => setGarden({ notes: v })} placeholder="e.g. Music outside until 22:00" maxLength={120} />
            </>
          ) : null}
        </Card>
      </Section>

      <Section title="Facilities and equipment" icon="speaker">
        <View style={{ gap: 8 }}>
          <T v="label">Equipment included</T>
          <Row gap={8} style={{ flexWrap: 'wrap' }}>
            {EQUIPMENT.map((e) => <Chip key={e} label={e} selected={draft.equipment === e} onPress={() => patch({ equipment: e })} />)}
          </Row>
        </View>
        <ListEditor
          items={facilities}
          onChange={(v) => patch({ facilities: v })}
          suggestions={FACILITY_SUGGESTIONS}
          placeholder="Add a facility"
          label="New facility"
          icon="check"
          empty="No facilities yet. Add what hosts can use: rooms, bars, green room, access."
        />
      </Section>

      <Section title="Requirements" icon="clipboard-check-outline" hint="House rules hosts agree to when they book.">
        <ListEditor
          items={requirements}
          onChange={(v) => patch({ requirements: v })}
          suggestions={REQUIREMENT_SUGGESTIONS}
          placeholder="Add a requirement"
          label="New requirement"
          icon="alert-circle-outline"
          empty="No requirements yet. Add curfew, age limit, deposit or safety rules."
        />
      </Section>

      <Section title="Pricing" icon="cash-multiple">
        <Segmented<PricingMode>
          options={[
            { key: 'listed', label: 'Price per night' },
            { key: 'quote', label: 'Quote on request' },
          ]}
          value={pricing}
          onChange={(k) => patch({ pricing: k })}
        />
        {pricing === 'listed' ? (
          <>
            <Field
              label="Price per night (€)"
              value={draft.pricePerNight ? String(draft.pricePerNight) : ''}
              onChangeText={(v) => patch({ pricePerNight: num(v) })}
              keyboardType="number-pad"
              placeholder="800"
              icon="currency-eur"
              maxLength={6}
            />
            <T v="small">
              {draft.pricePerNight > 0
                ? `You receive ${euro(providerNet(draft.pricePerNight))} per night after the ${Math.round(PLATFORM_COMMISSION_RATE * 100)}% Domtak commission.`
                : 'Hosts see this as your price per night.'}
            </T>
          </>
        ) : (
          <Banner icon="file-document-outline">Hosts send their date and guest count, and you reply with an itemised quote. No price is shown on your page until then.</Banner>
        )}
      </Section>

      <Section title="Other charges" icon="receipt-text-outline" hint="Listed separately from the venue hire.">
        <ChargesEditor items={extraCharges} onChange={(v) => patch({ extraCharges: v })} />
      </Section>

      <Section title="Catering" icon="silverware-fork-knife" hint="Priced per guest, so it follows the attendance.">
        <Card style={{ gap: 10 }}>
          <ToggleRow icon="silverware-fork-knife" label="Offer catering" hint={catering.available ? 'Hosts can add catering to a request' : 'Hosts bring their own caterer'} value={catering.available} onChange={(v) => setCatering({ available: v })} />
          {catering.available ? (
            <>
              <Field
                label="Price per guest (€)"
                value={catering.pricePerGuest ? String(catering.pricePerGuest) : ''}
                onChangeText={(v) => setCatering({ pricePerGuest: num(v) })}
                keyboardType="number-pad"
                placeholder="25"
                icon="currency-eur"
                maxLength={4}
              />
              <NumberRow icon="account-multiple-outline" label="Minimum guests" hint={catering.minGuests ? `Billed for at least ${catering.minGuests} guests` : 'No minimum'} value={catering.minGuests ?? 0} step={10} min={0} max={draft.capacity} onChange={(n) => setCatering({ minGuests: n || undefined })} />
              <Field label="Catering notes" value={catering.notes ?? ''} onChangeText={(v) => setCatering({ notes: v })} placeholder="e.g. Finger food and a drinks package" maxLength={120} />
            </>
          ) : null}
        </Card>
      </Section>

      <Section title="Security" icon="shield-account-outline" hint="Priced per guard; the number of guards follows the attendance.">
        <Card style={{ gap: 10 }}>
          <ToggleRow icon="shield-account-outline" label="Offer security" hint={security.available ? 'Hosts can add door staff to a request' : 'Hosts arrange their own door staff'} value={security.available} onChange={(v) => setSecurity({ available: v })} />
          {security.available ? (
            <>
              <NumberRow icon="account-group-outline" label="Guests per guard" hint={`1 guard for every ${security.guestsPerGuard} guests`} value={security.guestsPerGuard} step={5} min={10} max={500} onChange={(n) => setSecurity({ guestsPerGuard: n })} />
              <Field
                label="Price per guard (€)"
                value={security.pricePerGuard ? String(security.pricePerGuard) : ''}
                onChangeText={(v) => setSecurity({ pricePerGuard: num(v) })}
                keyboardType="number-pad"
                placeholder="180"
                icon="currency-eur"
                maxLength={4}
              />
              <ToggleRow
                icon="alert-circle-outline"
                label="Required for larger events"
                hint={security.requiredFrom != null ? `Added automatically from ${security.requiredFrom} guests` : 'Optional for every event'}
                value={security.requiredFrom != null}
                onChange={(v) => setSecurity({ requiredFrom: v ? Math.min(150, draft.capacity) : undefined })}
              />
              {security.requiredFrom != null ? (
                <NumberRow icon="account-multiple-outline" label="Required from" hint="Guests" value={security.requiredFrom} step={10} min={10} max={draft.capacity} onChange={(n) => setSecurity({ requiredFrom: n })} />
              ) : null}
              <Field label="Security notes" value={security.notes ?? ''} onChangeText={(v) => setSecurity({ notes: v })} placeholder="e.g. Licensed door staff" maxLength={120} />
            </>
          ) : null}
        </Card>
      </Section>

      {preview && (catering.available || security.available) ? (
        <Section title="Price check" icon="calculator-variant-outline" hint="What a host sees for a given attendance.">
          <Card style={{ gap: 10 }}>
            <Row justify="space-between" gap={12}>
              <T v="bodyBold" style={{ flex: 1 }}>Example guests</T>
              <Stepper value={guests} onChange={setExampleGuests} min={10} max={draft.capacity} step={10} label="example guests" />
            </Row>
            <T v="bodyBold" accessibilityLiveRegion="polite">
              {`For ${guests} guests: ${[
                catering.available ? `catering ${euro(cateringCost(preview, guests))}` : '',
                security.available ? `security ${euro(securityCost(preview, guests))} (${plural(guardsFor(guests, security.guestsPerGuard), 'guard')})` : '',
              ]
                .filter(Boolean)
                .join(', ')}`}
            </T>
            {estimate && estimate.items.length ? <LineItems items={toLineItems(estimate.items)} total={estimate.total} totalLabel={pricing === 'quote' ? 'Without venue hire' : 'Estimated total'} /> : null}
          </Card>
        </Section>
      ) : null}

      <Section title="Occasions" hint={`${draft.occasions.length} selected. Hosts filter venues by these.`}>
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
