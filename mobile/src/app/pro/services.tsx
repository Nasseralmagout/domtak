import { router } from 'expo-router';
import { type ReactNode, useMemo, useState } from 'react';
import { View } from 'react-native';

import { ArtistPricingCard, artistPriceLabel, LessonCard } from '../../components/cards';
import { BottomBar, goBack, PermissionNotice, Screen, ScreenHeader } from '../../components/layout';
import { Avatar, Banner, Button, Card, Checklist, Chip, Field, Icon, type IconName, IconButton, Pill, Row, Segmented, Stepper, T, Toggle } from '../../components/ui';
import { profileById } from '../../data/mock';
import type { Lesson, PricingMode } from '../../data/types';
import { euro, plural } from '../../lib/format';
import { PLATFORM_COMMISSION_RATE, providerNet } from '../../lib/pricing';
import { LESSON_FORMAT_ICON, LESSON_FORMAT_LABEL, LESSON_LEVELS, OWN_ARTIST_ID, overlayArtist, PERFORMANCE_TYPES, servicesChecklist, type ServicesDraft, useServices, useServicesHydrated } from '../../store/services';
import { toast } from '../../store/toast';
import { activeWorkspace, useApp } from '../../store/useApp';
import { colors } from '../../theme';

/** The demo musician workspace manages this public profile (see store/services). */
const BASE_PROFILE = profileById(OWN_ARTIST_ID);
const FEE_MIN = 20;
const LESSON_FORMATS = Object.keys(LESSON_FORMAT_LABEL) as Lesson['format'][];

type ChargeMode = 'none' | 'charge';

const num = (v: string) => Number(v.replace(/\D/g, '')) || 0;
const modeOf = (n?: number): ChargeMode | undefined => (n == null ? undefined : n > 0 ? 'charge' : 'none');

/** JSON with sorted keys and no undefined values, so edits that change nothing do not count as changes. */
const stable = (v: unknown) =>
  JSON.stringify(v, (_k, val: unknown) =>
    val && typeof val === 'object' && !Array.isArray(val)
      ? Object.fromEntries(
          Object.entries(val as Record<string, unknown>)
            .filter(([k, x]) => x !== undefined && k !== 'publishedAt')
            .sort(([a], [b]) => a.localeCompare(b)),
        )
      : val,
  );

/** Next free lesson id for the demo musician ("adam-l3"), never reusing a published id. */
function nextLessonId(...lists: Lesson[][]) {
  const n = lists.flat().reduce((max, l) => Math.max(max, Number(/-l(\d+)$/.exec(l.id)?.[1] ?? 0)), 0);
  return `${OWN_ARTIST_ID}-l${n + 1}`;
}

function Section({ title, hint, icon, children }: { title: string; hint?: string; icon: IconName; children: ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      <View style={{ gap: 2 }}>
        <Row gap={8}>
          <Icon name={icon} size={20} color={colors.brandDeep} />
          <T v="h3" accessibilityRole="header">{title}</T>
        </Row>
        {hint ? <T v="small">{hint}</T> : null}
      </View>
      {children}
    </View>
  );
}

/** Travel or equipment: stated as "no charge" or as a separate amount, never folded into the fee. */
function ChargeEditor({
  icon,
  what,
  mode,
  amount,
  note,
  notePlaceholder,
  onMode,
  onAmount,
  onNote,
}: {
  icon: IconName;
  what: 'Travel' | 'Equipment';
  mode?: ChargeMode;
  amount?: number;
  note?: string;
  notePlaceholder: string;
  onMode: (m: ChargeMode) => void;
  onAmount: (n?: number) => void;
  onNote: (v: string) => void;
}) {
  const lower = what.toLowerCase();
  return (
    <Card style={{ gap: 10 }}>
      <Row gap={12}>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: mode === 'charge' ? colors.brandSoft : colors.chipIdle, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={20} color={mode === 'charge' ? colors.brand : colors.subtle} />
        </View>
        <View style={{ flex: 1 }}>
          <T v="bodyBold">{what} charge</T>
          <T v="small">
            {mode === 'charge' ? (amount ? `${euro(amount)} per booking, shown as its own line` : 'Enter the amount') : mode === 'none' ? `No separate ${lower} charge` : 'Not stated yet'}
          </T>
        </View>
      </Row>
      <Row gap={8} style={{ flexWrap: 'wrap' }}>
        <Chip label="No charge" icon={mode === 'none' ? 'check' : undefined} selected={mode === 'none'} accessibilityLabel={`No ${lower} charge`} onPress={() => onMode('none')} />
        <Chip label="Charge separately" icon={mode === 'charge' ? 'check' : undefined} selected={mode === 'charge'} accessibilityLabel={`Charge ${lower} separately`} onPress={() => onMode('charge')} />
      </Row>
      {mode === 'charge' ? (
        <>
          <Field
            label={`${what} amount (€)`}
            value={amount ? String(amount) : ''}
            onChangeText={(v) => onAmount(num(v) || undefined)}
            keyboardType="number-pad"
            placeholder={what === 'Travel' ? '40' : '120'}
            icon="currency-eur"
            maxLength={5}
          />
          <Field label={`${what} note`} value={note ?? ''} onChangeText={onNote} placeholder={notePlaceholder} maxLength={80} />
        </>
      ) : mode == null ? (
        <T v="small" color={colors.warning}>Until you choose, bookers see “No separate charge listed. Ask in your request.”</T>
      ) : null}
    </Card>
  );
}

const lessonIssues = (l: Lesson) =>
  [
    l.title.trim().length < 3 ? 'a title' : '',
    l.instrument.trim().length < 2 ? 'the instrument or skill' : '',
    l.format !== 'online' && !l.location?.trim() ? 'where it happens' : '',
    !l.quote && !(l.price && l.price > 0) ? 'a price per session (or quote on request)' : '',
  ].filter(Boolean);

/** Add or edit one lesson service: format, duration, level and its own price or quote (F23). */
function LessonEditor({ lesson, isNew, onSave, onCancel, onRemove }: { lesson: Lesson; isNew: boolean; onSave: (l: Lesson) => void; onCancel: () => void; onRemove?: () => void }) {
  const [l, setL] = useState<Lesson>(lesson);
  const set = (p: Partial<Lesson>) => setL((x) => ({ ...x, ...p }));
  const issues = lessonIssues(l);
  const save = () => {
    if (issues.length) return;
    onSave({
      ...l,
      title: l.title.trim(),
      instrument: l.instrument.trim(),
      location: l.format === 'online' ? undefined : l.location?.trim() || undefined,
      price: l.quote ? undefined : l.price,
      quote: l.quote || undefined,
      description: l.description?.trim() || undefined,
    });
  };
  return (
    <Card style={{ gap: 12, borderWidth: 2, borderColor: colors.brand }}>
      <Row justify="space-between">
        <T v="title" accessibilityRole="header">{isNew ? 'New lesson' : 'Edit lesson'}</T>
        <IconButton name="close" label="Cancel editing" size={40} iconSize={20} onPress={onCancel} />
      </Row>
      <Field label="Title" value={l.title} onChangeText={(v) => set({ title: v })} placeholder="e.g. DJ basics on CDJs" maxLength={50} />
      <Field label="Instrument or skill" value={l.instrument} onChangeText={(v) => set({ instrument: v })} placeholder="e.g. DJ, Guitar, Vocals" maxLength={30} />
      <View style={{ gap: 8 }}>
        <T v="label">Format</T>
        <Row gap={8} style={{ flexWrap: 'wrap' }}>
          {LESSON_FORMATS.map((f) => <Chip key={f} label={LESSON_FORMAT_LABEL[f]} icon={LESSON_FORMAT_ICON[f]} selected={l.format === f} onPress={() => set({ format: f })} />)}
        </Row>
      </View>
      {l.format !== 'online' ? (
        <Field label="Where" value={l.location ?? ''} onChangeText={(v) => set({ location: v })} placeholder={l.format === 'at-studio' ? 'e.g. Studio in Kreuzberg' : 'e.g. At your place in Berlin'} icon="map-marker-outline" maxLength={60} />
      ) : null}
      <Row justify="space-between" gap={12}>
        <View style={{ flex: 1 }}>
          <T v="bodyBold">Duration</T>
          <T v="small">Per session</T>
        </View>
        <Stepper value={l.durationMin} onChange={(n) => set({ durationMin: n })} min={30} max={180} step={15} label="lesson minutes" format={(n) => `${n} min`} />
      </Row>
      <View style={{ gap: 8 }}>
        <T v="label">Price</T>
        <Segmented<PricingMode>
          options={[
            { key: 'listed', label: 'Price per session' },
            { key: 'quote', label: 'Quote on request' },
          ]}
          value={l.quote ? 'quote' : 'listed'}
          onChange={(k) => set({ quote: k === 'quote' })}
        />
        {l.quote ? (
          <T v="small">Learners describe what they want to learn and you reply with a quote. No price is shown until then.</T>
        ) : (
          <Field accessibilityLabel="Price per session in euro" value={l.price ? String(l.price) : ''} onChangeText={(v) => set({ price: num(v) || undefined })} keyboardType="number-pad" placeholder="60" icon="currency-eur" maxLength={4} />
        )}
      </View>
      <View style={{ gap: 8 }}>
        <T v="label">Level</T>
        <Row gap={8} style={{ flexWrap: 'wrap' }}>
          {LESSON_LEVELS.map((lv) => <Chip key={lv} label={lv} selected={l.level === lv} onPress={() => set({ level: lv })} />)}
        </Row>
      </View>
      <Field label="What learners get (optional)" value={l.description ?? ''} onChangeText={(v) => set({ description: v })} placeholder="e.g. Beatmatching, phrasing and your first mix" multiline maxLength={200} />
      {issues.length ? <T v="small" color={colors.warning}>Still needed: {issues.join(', ')}.</T> : null}
      <Row gap={10}>
        {onRemove ? <Button title="Remove" variant="ghost" icon="trash-can-outline" size="md" accessibilityLabel={`Remove ${lesson.title || 'this lesson'}`} onPress={onRemove} /> : null}
        <Button title={isNew ? 'Add lesson' : 'Save lesson'} icon="check" size="md" disabled={issues.length > 0} style={{ flex: 1 }} onPress={save} />
      </Row>
    </Card>
  );
}

export default function ServicesScreen() {
  const user = useApp((s) => s.user);
  const hydrated = useServicesHydrated();
  if (activeWorkspace(user) !== 'musician' || !BASE_PROFILE) {
    return (
      <Screen header={<ScreenHeader title="Services and pricing" onBack={() => goBack('/pro/workspace')} />}>
        <PermissionNotice role="musician" action="set up services and pricing" />
      </Screen>
    );
  }
  // The editor starts from your saved draft, so wait until it is loaded.
  if (!hydrated) return <Screen header={<ScreenHeader title="Services and pricing" onBack={() => goBack('/pro/workspace')} />}>{null}</Screen>;
  return <ServicesEditor />;
}

function ServicesEditor() {
  const fee = useApp((s) => s.availability.feePerHour);
  const minHours = useApp((s) => s.availability.minHours);
  const requests = useApp((s) => s.requests);
  const setAvailability = useApp((s) => s.setAvailability);
  const services = useServices((s) => s.services);
  const savedDraft = useServices((s) => s.servicesDraft);
  const publishServices = useServices((s) => s.publishServices);
  const saveServicesDraft = useServices((s) => s.saveServicesDraft);
  const discardServicesDraft = useServices((s) => s.discardServicesDraft);

  const live: ServicesDraft = useMemo(() => ({ ...services, feePerHour: fee }), [services, fee]);
  const [draft, setDraft] = useState<ServicesDraft>(() => savedDraft ?? { ...services, feePerHour: fee });
  const [travelMode, setTravelMode] = useState<ChargeMode | undefined>(() => modeOf((savedDraft ?? services).travel));
  const [equipmentMode, setEquipmentMode] = useState<ChargeMode | undefined>(() => modeOf((savedDraft ?? services).equipment));
  const [editing, setEditing] = useState<string | null>(null);
  const [customType, setCustomType] = useState('');

  const preview = useMemo(() => (BASE_PROFILE ? overlayArtist(BASE_PROFILE, draft, draft.feePerHour) : undefined), [draft]);
  if (!preview) return null;

  const patch = (p: Partial<ServicesDraft>) => setDraft((d) => ({ ...d, ...p }));
  const differsFromLive = stable(draft) !== stable(live);
  const unsaved = stable(draft) !== stable(savedDraft ?? live);
  const status = !differsFromLive ? 'Published · live on your profile' : unsaved ? 'Unsaved changes · not live' : 'Draft saved · not live';

  const checklist = servicesChecklist(draft).map((c) => ({ label: c.label, done: c.done, hint: c.hint }));
  const missing = checklist.filter((c) => !c.done).length;
  const complete = missing === 0;
  const quote = draft.pricing === 'quote';

  // F07: accepted work keeps the terms agreed at the time.
  const agreed = requests.filter((r) => r.status === 'accepted' && r.kind !== 'venue');
  const termsChanged =
    draft.feePerHour !== fee ||
    draft.pricing !== services.pricing ||
    draft.travel !== services.travel ||
    draft.equipment !== services.equipment ||
    stable(draft.lessons) !== stable(services.lessons);

  const togglePerformance = (p: string) => patch({ performances: draft.performances.includes(p) ? draft.performances.filter((x) => x !== p) : [...draft.performances, p] });
  const addCustomType = () => {
    const t = customType.trim();
    setCustomType('');
    if (!t || draft.performances.some((x) => x.toLowerCase() === t.toLowerCase())) return;
    patch({ performances: [...draft.performances, t] });
  };
  const typeOptions = Array.from(new Set([...PERFORMANCE_TYPES, ...draft.performances]));

  const setChargeMode = (key: 'travel' | 'equipment', m: ChargeMode) => {
    if (key === 'travel') setTravelMode(m);
    else setEquipmentMode(m);
    const current = draft[key];
    const value = m === 'none' ? 0 : current && current > 0 ? current : undefined;
    patch(key === 'travel' ? { travel: value } : { equipment: value });
  };

  const saveLesson = (l: Lesson) => {
    const isNew = !draft.lessons.some((x) => x.id === l.id);
    patch({ lessons: isNew ? [...draft.lessons, l] : draft.lessons.map((x) => (x.id === l.id ? l : x)) });
    setEditing(null);
    toast(isNew ? `${l.title} added to your draft` : `${l.title} updated in your draft`);
  };
  const removeLesson = (l: Lesson) => {
    patch({ lessons: draft.lessons.filter((x) => x.id !== l.id) });
    setEditing(null);
    toast(`${l.title} removed from your draft. Accepted lesson bookings keep their terms.`);
  };
  const newLesson: Lesson = { id: nextLessonId(draft.lessons, services.lessons), title: '', instrument: '', format: 'at-studio', durationMin: 60, level: LESSON_LEVELS[0] };

  const clean = (): ServicesDraft => ({
    ...draft,
    performanceNote: draft.performanceNote.trim(),
    performanceTerms: draft.performanceTerms.trim(),
    lessonTerms: draft.lessonTerms.trim(),
    travelNote: draft.travel ? draft.travelNote?.trim() || undefined : undefined,
    equipmentNote: draft.equipment ? draft.equipmentNote?.trim() || undefined : undefined,
  });
  const saveDraft = () => {
    saveServicesDraft(draft);
    toast('Draft saved. Bookers still see your published services.');
  };
  const publish = () => {
    if (!complete) return;
    const { feePerHour, ...rest } = clean();
    publishServices(rest);
    // A quote-only artist may leave the hourly price empty: keep the last one on file.
    if (feePerHour >= FEE_MIN) setAvailability({ feePerHour });
    toast('Published. New requests use these services; accepted bookings keep their agreed terms.');
    goBack('/pro/workspace');
  };
  const discard = () => {
    setDraft(live);
    setTravelMode(modeOf(live.travel));
    setEquipmentMode(modeOf(live.equipment));
    setEditing(null);
    discardServicesDraft();
    toast('Draft discarded');
  };
  const leave = () => {
    if (unsaved && differsFromLive) {
      saveServicesDraft(draft);
      toast('Draft saved. It is not live until you publish.');
    }
    goBack('/pro/workspace');
  };
  const previewProfile = () => {
    if (differsFromLive) {
      // The preview reads the saved draft, so save it first.
      saveServicesDraft(draft);
      router.push({ pathname: '/artist/[id]', params: { id: OWN_ARTIST_ID, preview: 'draft' } });
    } else {
      router.push({ pathname: '/artist/[id]', params: { id: OWN_ARTIST_ID } });
    }
  };

  return (
    <Screen
      keyboard
      header={<ScreenHeader title="Services and pricing" subtitle={status} onBack={leave} right={<IconButton name="eye-outline" label="Preview profile" color={colors.brand} onPress={previewProfile} />} />}
      footer={
        <BottomBar>
          {differsFromLive ? (
            <View style={{ gap: 8 }}>
              <T v="small" color={complete ? colors.muted : colors.warning}>
                {complete ? 'Ready to publish. New requests will use these services.' : `Complete ${plural(missing, 'more item')} to publish. Your profile keeps the published version.`}
              </T>
              <Row gap={10}>
                <Button title={unsaved ? 'Save draft' : 'Draft saved'} variant="secondary" icon="content-save-outline" disabled={!unsaved} style={{ flex: 1 }} onPress={saveDraft} />
                <Button title="Publish" icon="check" disabled={!complete} style={{ flex: 1.2 }} accessibilityLabel={complete ? 'Publish your services' : `Publish, ${plural(missing, 'item')} missing`} onPress={publish} />
              </Row>
              <Button title="Discard changes" variant="ghost" size="sm" onPress={discard} />
            </View>
          ) : (
            <Row gap={10}>
              <Button title="Preview profile" variant="secondary" icon="eye-outline" style={{ flex: 1 }} onPress={previewProfile} />
              <Button title="Done" icon="check" style={{ flex: 1 }} onPress={() => goBack('/pro/workspace')} />
            </Row>
          )}
        </BottomBar>
      }
    >
      <Card style={{ gap: 12 }}>
        <Row gap={12}>
          <Avatar src={preview.avatar} size={52} label={preview.name} verified={preview.verified} />
          <View style={{ flex: 1 }}>
            <T v="title" numberOfLines={1}>{preview.name}</T>
            <T v="small" numberOfLines={1}>{preview.title} · {preview.city}</T>
          </View>
          <Pill label={differsFromLive ? 'Draft' : 'Live'} tone={differsFromLive ? 'warning' : 'success'} icon={differsFromLive ? 'file-document-edit-outline' : 'check'} />
        </Row>
        <Row gap={14} style={{ flexWrap: 'wrap' }}>
          <Row gap={4}><Icon name="cash-multiple" size={16} color={colors.brand} /><T v="smallBold">{artistPriceLabel(preview)}</T></Row>
          <Row gap={4}><Icon name="microphone-variant" size={16} color={colors.brand} /><T v="small" color={colors.inkSoft}>{plural(draft.performances.length, 'performance type')}</T></Row>
          <Row gap={4}><Icon name="school-outline" size={16} color={colors.brand} /><T v="small" color={colors.inkSoft}>{draft.lessons.length ? plural(draft.lessons.length, 'lesson') : 'No lessons'}</T></Row>
        </Row>
        <Button title="Preview profile" variant="light" size="md" icon="eye-outline" onPress={previewProfile} />
      </Card>

      <Card style={{ gap: 4 }}>
        <Checklist title="Profile readiness" items={checklist} />
        <T v="small" style={{ marginTop: 6 }}>{complete ? 'Everything bookers need is filled in.' : 'Incomplete changes stay a draft. Bookers see your last published services.'}</T>
      </Card>

      <Banner icon="shield-alert-outline" tone={termsChanged && agreed.length ? 'warning' : 'brand'}>
        <View style={{ gap: 4 }}>
          <T v="small" color={termsChanged && agreed.length ? colors.warning : colors.brand}>
            {`Changes apply to new requests only. Accepted bookings keep the price and terms agreed at the time${agreed.length ? ` (${plural(agreed.length, 'accepted booking')} right now)` : ''}.`}
          </T>
          {termsChanged && agreed.length
            ? agreed.slice(0, 3).map((r) => (
                <T key={r.id} v="smallBold" color={colors.warning}>
                  {r.title} · {r.date} · {euro(r.offer)} agreed
                </T>
              ))
            : null}
        </View>
      </Banner>

      <Section title="Performances" icon="microphone-variant" hint="What bookers can request from you.">
        <Card style={{ gap: 12 }}>
          <T v="label">What you perform at</T>
          <Row gap={8} style={{ flexWrap: 'wrap' }}>
            {typeOptions.map((p) => <Chip key={p} label={p} icon={draft.performances.includes(p) ? 'check' : undefined} selected={draft.performances.includes(p)} onPress={() => togglePerformance(p)} />)}
          </Row>
          <Field
            accessibilityLabel="Add another performance type"
            value={customType}
            onChangeText={setCustomType}
            placeholder="Add another type"
            maxLength={30}
            returnKeyType="done"
            onSubmitEditing={addCustomType}
            right={<Button title="Add" size="sm" disabled={!customType.trim()} accessibilityLabel={`Add ${customType.trim() || 'performance type'}`} onPress={addCustomType} />}
          />
          <Field label="What a performance includes" value={draft.performanceNote} onChangeText={(v) => patch({ performanceNote: v })} placeholder="Set length, style and the gear you bring" multiline maxLength={240} />
        </Card>
      </Section>

      <Section title="Performance price" icon="cash-multiple" hint="A listed hourly price, or quotes on request. Travel and equipment are separate below.">
        <Segmented<PricingMode>
          options={[
            { key: 'listed', label: 'Price per hour' },
            { key: 'quote', label: 'Quote on request' },
          ]}
          value={draft.pricing}
          onChange={(k) => patch({ pricing: k })}
        />
        {quote ? (
          <Banner icon="file-document-outline">Bookers send their date, hours and guest count, and you reply with an itemised quote. No price or total is shown on your profile until then.</Banner>
        ) : (
          <Card style={{ gap: 8 }}>
            <Field
              label="Price per hour (€)"
              value={draft.feePerHour ? String(draft.feePerHour) : ''}
              onChangeText={(v) => patch({ feePerHour: num(v) })}
              keyboardType="number-pad"
              placeholder="300"
              icon="currency-eur"
              maxLength={4}
              error={draft.feePerHour > 0 && draft.feePerHour < FEE_MIN ? `At least ${euro(FEE_MIN)} per hour` : undefined}
            />
            <T v="small">
              {draft.feePerHour >= FEE_MIN
                ? `You receive ${euro(providerNet(draft.feePerHour))} per hour after the ${Math.round(PLATFORM_COMMISSION_RATE * 100)}% Domtak commission. Minimum booking ${plural(minHours, 'hour')} (set in Availability).`
                : 'Bookers see this as your price per hour for the performance itself.'}
            </T>
          </Card>
        )}
      </Section>

      <Section title="Separate charges" icon="receipt-text-outline" hint="Shown as their own lines in every request and quote, never folded into your fee.">
        <ChargeEditor
          icon="car-outline"
          what="Travel"
          mode={travelMode}
          amount={draft.travel}
          note={draft.travelNote}
          notePlaceholder="e.g. Within Berlin"
          onMode={(m) => setChargeMode('travel', m)}
          onAmount={(n) => patch({ travel: n })}
          onNote={(v) => patch({ travelNote: v })}
        />
        <ChargeEditor
          icon="speaker"
          what="Equipment"
          mode={equipmentMode}
          amount={draft.equipment}
          note={draft.equipmentNote}
          notePlaceholder="e.g. Own CDJ setup when the venue has none"
          onMode={(m) => setChargeMode('equipment', m)}
          onAmount={(n) => patch({ equipment: n })}
          onNote={(v) => patch({ equipmentNote: v })}
        />
      </Section>

      <Section title="Performance terms" icon="file-document-outline" hint="What bookers agree to. Lessons have their own terms.">
        <Field accessibilityLabel="Performance terms" value={draft.performanceTerms} onChangeText={(v) => patch({ performanceTerms: v })} placeholder="Set length, breaks, rider and what happens if plans change" multiline maxLength={400} />
      </Section>

      <Section title="Lessons" icon="school-outline" hint="Optional. Each lesson has its own price and terms; your performance price is never reused.">
        {draft.lessons.map((l) =>
          editing === l.id ? (
            <LessonEditor key={l.id} lesson={l} isNew={false} onSave={saveLesson} onCancel={() => setEditing(null)} onRemove={() => removeLesson(l)} />
          ) : (
            <LessonCard
              key={l.id}
              lesson={l}
              onPress={() => setEditing(l.id)}
              right={<IconButton name="pencil-outline" label={`Edit ${l.title}`} size={40} iconSize={20} color={colors.brand} onPress={() => setEditing(l.id)} />}
            />
          ),
        )}
        {editing === 'new' ? (
          <LessonEditor key={newLesson.id} lesson={newLesson} isNew onSave={saveLesson} onCancel={() => setEditing(null)} />
        ) : (
          <Button title="Add a lesson" variant="secondary" size="md" icon="plus" onPress={() => setEditing('new')} />
        )}
        {!draft.lessons.length && editing !== 'new' ? <T v="small">You don’t offer lessons yet. Add one to appear when members look for lessons.</T> : null}
        {draft.lessons.length ? (
          <Field label="Lesson terms" value={draft.lessonTerms} onChangeText={(v) => patch({ lessonTerms: v })} placeholder="Sessions, what to bring, rescheduling" multiline maxLength={400} />
        ) : null}
      </Section>

      <Section title="Availability calendar" icon="calendar-check" hint="Optional. Helps bookers plan.">
        <Card style={{ gap: 10 }}>
          <Row gap={12} style={{ minHeight: 56 }}>
            <View style={{ flex: 1 }}>
              <T v="bodyBold">Show availability on my profile</T>
              <T v="small">{draft.showCalendar ? 'Usual days and blocked dates are visible' : 'Bookers just send a request'}</T>
            </View>
            <Toggle label="Show availability on my profile" value={draft.showCalendar} onValueChange={(v) => patch({ showCalendar: v })} />
          </Row>
          <Banner icon="information-outline">Calendar availability supports search but never confirms a booking. You still accept or decline every request.</Banner>
          <Button title="Edit availability" variant="secondary" size="md" icon="calendar-edit" onPress={() => router.push('/pro/availability')} />
        </Card>
      </Section>

      <Section title="Preview: what bookers see" icon="eye-outline">
        <ArtistPricingCard artist={preview} services={draft} />
      </Section>
    </Screen>
  );
}
