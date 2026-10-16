import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { BottomBar, goBack, Screen, ScreenHeader } from '../components/layout';
import { Banner, Button, Card, Chip, Field, Icon, Photo, Pill, ProgressBar, Radio, Row, T } from '../components/ui';
import type { ImgKey } from '../data/images';
import { GENRES } from '../data/mock';
import type { Application, ProfessionalRole } from '../data/types';
import { APPLY_FIELDS, type ApplyField, type ApplyStep, photoCount, PRO_ROLE_PITCH, PRO_ROLE_TITLE, WORKSPACE_ICON } from '../lib/access';
import { dateTime } from '../lib/format';
import { toast } from '../store/toast';
import { APPLICATION_STATUS_LABEL, APPLICATION_STATUS_TONE, isApproved, PROFESSIONAL_ROLES, useApp } from '../store/useApp';
import { colors, radius } from '../theme';

const STEP_TITLES = ['Professional role', 'Role details', 'Supporting information', 'Review and submit'];
const FIELD_STEP: Record<1 | 2, ApplyStep> = { 1: 'details', 2: 'support' };
const DECLARATION: Record<ProfessionalRole, string> = {
  musician: 'I confirm these details are accurate and that I perform as, or represent, this act.',
  venue: 'I confirm these details are accurate and that I may take bookings for this venue.',
  organizer: 'I confirm these details are accurate and that I represent this organisation.',
};

interface Answers {
  values: Record<string, string>;
  genres: string[];
  media: Record<string, ImgKey[]>;
}

const EMPTY: Answers = { values: {}, genres: [], media: {} };

const isRole = (v?: string): v is ProfessionalRole => !!v && (PROFESSIONAL_ROLES as string[]).includes(v);

/** Turns a saved application back into form answers, so a resubmission starts from what was sent. */
function fromApplication(app: Application): Answers {
  const out: Answers = { values: {}, genres: [], media: {} };
  for (const f of APPLY_FIELDS[app.role]) {
    const saved = app.details[f.label];
    if (!saved) continue;
    if (f.kind === 'genres') out.genres = saved.split(',').map((g) => g.trim()).filter((g) => GENRES.includes(g));
    else if (f.kind === 'media') out.media[f.label] = (f.gallery ?? []).slice(0, parseInt(saved, 10) || 0);
    else if (f.kind === 'number') out.values[f.label] = saved.replace(/\D/g, '');
    else out.values[f.label] = saved;
  }
  return out;
}

/** The answer as stored in Application.details (the reviewer reads the same label). */
function answerOf(f: ApplyField, a: Answers): string {
  if (f.kind === 'genres') return a.genres.join(', ');
  if (f.kind === 'media') {
    const n = a.media[f.label]?.length ?? 0;
    return n ? photoCount(n) : '';
  }
  const v = (a.values[f.label] ?? '').trim();
  if (f.kind === 'number') return v ? `${f.prefix ?? ''}${v}` : '';
  return v;
}

function problemOf(f: ApplyField, a: Answers): string | undefined {
  if (f.kind === 'genres') return f.required && !a.genres.length ? 'Pick at least one genre' : undefined;
  if (f.kind === 'media') return f.required && !a.media[f.label]?.length ? 'Choose at least one photo' : undefined;
  const v = (a.values[f.label] ?? '').trim();
  if (!v) return f.required ? (f.kind === 'choice' ? 'Choose one option' : `${f.label} is required`) : undefined;
  if (f.kind === 'number' && !(Number(v) > 0)) return 'Enter a number above 0';
  if (f.kind === 'link' && !/^\S+\.\S{2,}/.test(v)) return 'Enter a web address, e.g. soundcloud.com/yourname';
  if (f.min && v.length < f.min) return `Add a little more detail (at least ${f.min} characters)`;
  return undefined;
}

function Requested() {
  return <Pill label="Requested by the reviewer" tone="warning" icon="alert-circle-outline" />;
}

function FieldLabel({ field, requested }: { field: ApplyField; requested: boolean }) {
  return (
    <View style={{ gap: 4 }}>
      {requested ? <Requested /> : null}
      <T v="label">{field.label}{field.required ? '' : ' (optional)'}</T>
      {field.hint ? <T v="small">{field.hint}</T> : null}
    </View>
  );
}

function FormField({ field, answers, error, requested, onChange }: { field: ApplyField; answers: Answers; error?: string; requested: boolean; onChange: (a: Answers) => void }) {
  const value = answers.values[field.label] ?? '';
  const setValue = (v: string) => onChange({ ...answers, values: { ...answers.values, [field.label]: v } });

  if (field.kind === 'choice') {
    return (
      <View style={{ gap: 8 }}>
        <FieldLabel field={field} requested={requested} />
        <View accessibilityRole="radiogroup" accessibilityLabel={field.label} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {(field.options ?? []).map((o) => (
            <Chip key={o} label={o} selected={value === o} onPress={() => setValue(value === o ? '' : o)} />
          ))}
        </View>
        {error ? <T v="small" color={colors.danger}>{error}</T> : null}
      </View>
    );
  }

  if (field.kind === 'genres') {
    return (
      <View style={{ gap: 8 }}>
        <FieldLabel field={field} requested={requested} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {GENRES.map((g) => {
            const on = answers.genres.includes(g);
            return <Chip key={g} label={g} selected={on} onPress={() => onChange({ ...answers, genres: on ? answers.genres.filter((x) => x !== g) : [...answers.genres, g] })} />;
          })}
        </View>
        {error ? <T v="small" color={colors.danger}>{error}</T> : null}
      </View>
    );
  }

  if (field.kind === 'media') {
    const picked = answers.media[field.label] ?? [];
    const toggle = (k: ImgKey) => {
      const next = picked.includes(k) ? picked.filter((x) => x !== k) : [...picked, k];
      onChange({ ...answers, media: { ...answers.media, [field.label]: next } });
    };
    return (
      <View style={{ gap: 8 }}>
        <FieldLabel field={field} requested={requested} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 2 }}>
          {(field.gallery ?? []).map((k, i) => {
            const on = picked.includes(k);
            return (
              <Pressable key={k} accessibilityRole="checkbox" accessibilityLabel={`${field.label}: photo ${i + 1}`} accessibilityState={{ checked: on }} onPress={() => toggle(k)} style={{ borderRadius: 16, borderWidth: 3, borderColor: on ? colors.brand : 'transparent' }}>
                <Photo src={k} radius={13} style={{ width: 84, height: 84 }} accessibilityLabel="" />
                {on ? (
                  <View style={{ position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="check" size={16} color={colors.white} />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
        <T v="small" color={error ? colors.danger : colors.muted}>{error ?? (picked.length ? `${photoCount(picked.length)} selected` : 'No photos selected yet')}</T>
      </View>
    );
  }

  return (
    <View style={{ gap: 6 }}>
      {requested ? <Requested /> : null}
      <Field
        label={`${field.label}${field.required ? '' : ' (optional)'}`}
        value={value}
        onChangeText={(t) => setValue(field.kind === 'number' ? t.replace(/\D/g, '').slice(0, 6) : t)}
        placeholder={field.placeholder}
        multiline={field.kind === 'multiline'}
        maxLength={field.kind === 'multiline' ? 600 : 120}
        keyboardType={field.kind === 'number' ? 'number-pad' : field.kind === 'link' ? 'url' : 'default'}
        autoCapitalize={field.kind === 'link' ? 'none' : 'sentences'}
        autoCorrect={field.kind !== 'link'}
        right={field.prefix && value ? <T v="bodyBold" color={colors.muted}>{field.prefix}</T> : undefined}
        error={error}
      />
      {field.hint ? <T v="small">{field.hint}</T> : null}
    </View>
  );
}

export default function Apply() {
  const params = useLocalSearchParams<{ role?: string }>();
  const user = useApp((s) => s.user);
  const submitApplication = useApp((s) => s.submitApplication);
  const app = user.application;
  const resubmitting = app?.status === 'info' || app?.status === 'rejected' ? app : undefined;

  const [role, setRole] = useState<ProfessionalRole | undefined>(() => {
    if (isRole(params.role) && !isApproved(user, params.role)) return params.role;
    return resubmitting?.role;
  });
  const [answers, setAnswers] = useState<Answers>(() => (resubmitting ? fromApplication(resubmitting) : EMPTY));
  // A "more information" request opens on the details, with the requested items marked.
  const [step, setStep] = useState(() => (app?.status === 'info' && (!isRole(params.role) || params.role === app.role) ? 1 : 0));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmed, setConfirmed] = useState(false);

  const back = () => {
    if (step === 0) return goBack('/(tabs)');
    setErrors({});
    setStep(step - 1);
  };

  // One application is reviewed at a time: while it is pending, show where to follow it.
  if (app?.status === 'pending') {
    return (
      <Screen header={<ScreenHeader title="Professional application" />} contentStyle={{ paddingHorizontal: 24, paddingTop: 24, gap: 16, alignItems: 'center' }}>
        <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="clock-outline" size={44} color={colors.brand} />
        </View>
        <T v="h2" center>Your application is in review</T>
        <T v="body" color={colors.muted} center>
          You applied as {PRO_ROLE_TITLE[app.role].toLowerCase()} on {dateTime(app.submittedAt)}. Our team aims to decide within 24 hours. You can apply for another role once this review is finished.
        </T>
        <Button title="View application status" icon="file-document-outline" onPress={() => router.replace('/application')} full style={{ alignSelf: 'stretch' }} />
      </Screen>
    );
  }

  const fields = role ? APPLY_FIELDS[role] : [];
  const requested = resubmitting?.status === 'info' && resubmitting.role === role ? (resubmitting.missing ?? []) : [];
  const stepFields = step === 1 || step === 2 ? fields.filter((f) => f.step === FIELD_STEP[step]) : [];
  const allApproved = PROFESSIONAL_ROLES.every((r) => isApproved(user, r));

  const pickRole = (r: ProfessionalRole) => {
    if (r === role) return;
    setRole(r);
    setErrors({});
    // Answers belong to one role; a resubmission keeps them only for its own role.
    setAnswers(resubmitting?.role === r ? fromApplication(resubmitting) : EMPTY);
  };

  const validate = (list: ApplyField[]) => {
    const e: Record<string, string> = {};
    for (const f of list) {
      const p = problemOf(f, answers);
      if (p) e[f.label] = p;
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => {
    if (step === 0) {
      if (!role) return toast('Choose the professional role you are applying for');
      setStep(1);
      return;
    }
    if (step === 1 || step === 2) {
      if (!validate(stepFields)) return;
      setStep(step + 1);
      return;
    }
    if (!role) return;
    if (!validate(fields)) {
      const firstBad = fields.find((f) => problemOf(f, answers));
      if (firstBad) setStep(firstBad.step === 'details' ? 1 : 2);
      return;
    }
    if (!confirmed) return setErrors({ confirm: 'Please confirm the declaration' });
    const details: Record<string, string> = {};
    for (const f of fields) {
      const v = answerOf(f, answers);
      if (v) details[f.label] = v;
    }
    submitApplication(role, details);
    toast(resubmitting ? 'Application resubmitted for review' : 'Application submitted for review');
    router.replace('/application');
  };

  const errorCount = Object.keys(errors).filter((k) => k !== 'confirm').length;
  const primaryTitle = step === 3 ? (resubmitting ? 'Resubmit application' : 'Submit application') : step === 0 ? 'Continue' : 'Next';

  return (
    <Screen
      key={step}
      keyboard
      header={<ScreenHeader title="Professional application" subtitle={`Step ${step + 1} of 4 · ${STEP_TITLES[step]}`} onBack={back} />}
      footer={
        <BottomBar>
          {errorCount ? <T v="small" color={colors.danger} style={{ marginBottom: 8 }}>{errorCount === 1 ? '1 answer needs attention' : `${errorCount} answers need attention`}</T> : null}
          {errors.confirm ? <T v="small" color={colors.danger} style={{ marginBottom: 8 }}>{errors.confirm}</T> : null}
          <Button title={primaryTitle} icon={step === 3 ? 'send' : undefined} disabled={step === 0 && !role} onPress={next} />
        </BottomBar>
      }
    >
      <ProgressBar value={(step + 1) / 4} label={`Step ${step + 1} of 4`} />

      {resubmitting?.status === 'info' && resubmitting.role === role ? (
        <Banner icon="file-document-edit-outline" tone="warning">
          {`The reviewer asked for: ${(resubmitting.missing ?? []).join(', ') || 'more detail'}.${resubmitting.reason ? ` ${resubmitting.reason}` : ''} Update these answers and resubmit.`}
        </Banner>
      ) : null}
      {resubmitting?.status === 'rejected' && step === 0 ? (
        <Banner icon="information-outline" tone="danger">
          {`Your ${PRO_ROLE_TITLE[resubmitting.role].toLowerCase()} application was not approved${resubmitting.reason ? `: ${resubmitting.reason}` : '.'} Update your answers and submit again, or apply for a different role.`}
        </Banner>
      ) : null}

      {step === 0 ? (
        <>
          <View style={{ gap: 6 }}>
            <T v="h2">Which professional account?</T>
            <T v="body" color={colors.muted}>Our team reviews every application, with a target response within 24 hours. Your member account keeps working meanwhile.</T>
          </View>
          <View accessibilityRole="radiogroup" style={{ gap: 12 }}>
            {PROFESSIONAL_ROLES.map((r) => {
              const approved = isApproved(user, r);
              const on = r === role;
              return (
                <Pressable
                  key={r}
                  accessibilityRole="radio"
                  accessibilityLabel={`${PRO_ROLE_TITLE[r]}. ${PRO_ROLE_PITCH[r]}${approved ? ' Already approved.' : ''}`}
                  accessibilityHint={approved ? 'Opens your workspaces' : undefined}
                  accessibilityState={{ checked: on }}
                  onPress={() => (approved ? router.push('/workspace') : pickRole(r))}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: radius.lg, borderWidth: on ? 2 : 1, borderColor: on ? colors.brand : colors.border, backgroundColor: on ? colors.brandTint : colors.surface }}
                >
                  <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: on ? colors.brand : colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={WORKSPACE_ICON[r]} size={24} color={on ? colors.white : colors.brand} />
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <T v="bodyBold" style={{ fontSize: 16 }}>{PRO_ROLE_TITLE[r]}</T>
                    <T v="small">{PRO_ROLE_PITCH[r]}</T>
                    {approved ? <Pill label="Approved" tone="success" icon="check-decagram" /> : resubmitting?.role === r ? <Pill label={APPLICATION_STATUS_LABEL[resubmitting.status]} tone={APPLICATION_STATUS_TONE[resubmitting.status]} /> : null}
                  </View>
                  {approved ? <Icon name="chevron-right" size={22} color={colors.subtle} /> : <Radio selected={on} />}
                </Pressable>
              );
            })}
          </View>
          {allApproved ? (
            <Banner icon="check-decagram" tone="success">You’re approved for every professional role. Switch between them from your workspaces.</Banner>
          ) : null}
          {role ? (
            <Card style={{ gap: 8 }}>
              <T v="title">What you’ll need</T>
              {fields.filter((f) => f.required).map((f) => (
                <Row key={f.label} gap={10}>
                  <Icon name="check-circle-outline" size={18} color={colors.brand} />
                  <T v="small" style={{ flex: 1 }}>{f.label}</T>
                </Row>
              ))}
              <T v="small" color={colors.label}>Optional extras help the review but are not required.</T>
            </Card>
          ) : null}
        </>
      ) : null}

      {role && (step === 1 || step === 2) ? (
        <>
          <View style={{ gap: 6 }}>
            <T v="h2">{step === 1 ? `${PRO_ROLE_TITLE[role]} details` : 'Supporting information'}</T>
            <T v="body" color={colors.muted}>
              {step === 1 ? 'This becomes the start of your professional profile.' : 'This helps the reviewer check your application. It is not shown publicly.'}
            </T>
          </View>
          {stepFields.map((f) => (
            <FormField key={f.label} field={f} answers={answers} error={errors[f.label]} requested={requested.includes(f.label)} onChange={setAnswers} />
          ))}
        </>
      ) : null}

      {role && step === 3 ? (
        <>
          <View style={{ gap: 6 }}>
            <T v="h2">Review your application</T>
            <T v="body" color={colors.muted}>Check your answers before you send them to our review team.</T>
          </View>
          <Card style={{ gap: 4 }}>
            <Row justify="space-between">
              <T v="title">Role</T>
              <Button title="Change" variant="ghost" size="sm" onPress={() => setStep(0)} />
            </Row>
            <Row gap={10}>
              <Icon name={WORKSPACE_ICON[role]} size={20} color={colors.brand} />
              <T v="bodyBold">{PRO_ROLE_TITLE[role]}</T>
            </Row>
          </Card>
          {([1, 2] as const).map((s) => (
            <Card key={s} style={{ gap: 10 }}>
              <Row justify="space-between">
                <T v="title">{STEP_TITLES[s]}</T>
                <Button title="Edit" variant="ghost" size="sm" onPress={() => setStep(s)} />
              </Row>
              {fields.filter((f) => f.step === FIELD_STEP[s]).map((f) => {
                const v = answerOf(f, answers);
                const bad = errors[f.label];
                return (
                  <View key={f.label} style={{ gap: 2 }}>
                    <T v="label">{f.label}</T>
                    <T v="body" color={bad ? colors.danger : v ? colors.ink : colors.subtle}>{bad ?? (v || 'Not provided')}</T>
                    {requested.includes(f.label) ? <T v="small" color={colors.warning}>Requested by the reviewer</T> : null}
                  </View>
                );
              })}
            </Card>
          ))}
          <Pressable
            accessibilityRole="checkbox"
            accessibilityLabel={DECLARATION[role]}
            accessibilityState={{ checked: confirmed }}
            onPress={() => {
              setConfirmed(!confirmed);
              if (errors.confirm) setErrors({});
            }}
            style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingVertical: 8, minHeight: 44 }}
          >
            <View style={{ width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: errors.confirm ? colors.danger : colors.brand, backgroundColor: confirmed ? colors.brand : colors.surface, alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
              {confirmed ? <Icon name="check" size={16} color={colors.white} /> : null}
            </View>
            <T v="small" color={colors.inkSoft} style={{ flex: 1 }}>{DECLARATION[role]}</T>
          </Pressable>
          <Banner icon="clock-outline">
            What happens next: our team reviews your application, with a target response within 24 hours. Submitting does not unlock professional tools; they open only after approval.
          </Banner>
        </>
      ) : null}
    </Screen>
  );
}
