import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Screen, ScreenHeader } from '../components/layout';
import { Banner, Button, Card, Field, Radio, Row, SectionTitle, T } from '../components/ui';
import { toast } from '../store/toast';
import { useApp } from '../store/useApp';
import { colors, fonts, radius } from '../theme';

export default function PaymentMethods() {
  const params = useLocalSearchParams<{ add?: string; payout?: string; iban?: string }>();
  const methods = useApp((s) => s.paymentMethods);
  const selected = useApp((s) => s.selectedPayment);
  const setSelected = useApp((s) => s.setSelectedPayment);
  const addMethod = useApp((s) => s.addPaymentMethod);
  const role = useApp((s) => s.user.role);
  const [adding, setAdding] = useState(params.add === '1');
  const [addingIban, setAddingIban] = useState(params.iban === '1');
  const [iban, setIban] = useState('');
  const [holder, setHolder] = useState('');
  const [ibanError, setIbanError] = useState<string>();
  const payoutAccount = methods.find((m) => m.badge === 'SEPA');
  const [number, setNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [error, setError] = useState<string>();

  const save = () => {
    const digits = number.replace(/\D/g, '');
    if (digits.length < 12) return setError('Enter a valid card number');
    if (!/^\d{2}\/\d{2}$/.test(expiry)) return setError('Expiry must look like 08/28');
    if (cvc.length < 3) return setError('Enter the 3-digit security code');
    addMethod({ label: `Card •••• ${digits.slice(-4)}`, sub: `Expires ${expiry}`, badge: digits.startsWith('5') ? 'MC' : 'VISA' });
    setAdding(false);
    setNumber('');
    setExpiry('');
    setCvc('');
    setError(undefined);
    toast(`Card ending ${digits.slice(-4)} added and set as default`);
    // Opened from checkout to add a card: return there (only when there is a screen to return to).
    if (params.add === '1' && router.canGoBack()) router.back();
  };

  const saveIban = () => {
    const compact = iban.replace(/\s/g, '').toUpperCase();
    if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(compact)) return setIbanError('Enter a valid IBAN, e.g. DE89 3704 0044 0532 0130 00');
    if (holder.trim().length < 3) return setIbanError('Enter the account holder’s name');
    const previous = selected;
    addMethod({ label: 'SEPA direct debit', sub: `${compact.slice(0, 2)}•• •••• ${compact.slice(-4)}`, badge: 'SEPA' });
    // A payout account shouldn't silently become the default way to pay for bookings.
    if (previous) setSelected(previous);
    setAddingIban(false);
    setIban('');
    setHolder('');
    setIbanError(undefined);
    toast(`Bank account ending ${compact.slice(-4)} added`);
    if (params.iban === '1' && router.canGoBack()) router.back();
  };

  const cancel = () => {
    setAdding(false);
    setError(undefined);
    if (params.add === '1' && router.canGoBack()) router.back();
  };

  // Payouts live on the Earnings screen; keep old ?payout=1 links working.
  if (params.payout === '1') return <Redirect href="/pro/earnings" />;

  return (
    <Screen keyboard header={<ScreenHeader title="Payment methods" />}>
      <View accessibilityRole="radiogroup" style={{ gap: 10 }}>
        {methods.map((m) => {
          const on = m.id === selected;
          return (
            <Pressable key={m.id} accessibilityRole="radio" accessibilityLabel={`${m.label}, ${m.sub}`} accessibilityState={{ checked: on }} onPress={() => setSelected(m.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, height: 68, paddingHorizontal: 16, borderRadius: radius.lg, borderWidth: on ? 2 : 1, borderColor: on ? colors.brand : colors.border, backgroundColor: on ? colors.brandTint : colors.surface }}>
              <View style={{ width: 52, height: 34, borderRadius: 6, backgroundColor: m.badge === 'PP' ? '#1F4E9C' : m.badge === 'VISA' ? colors.brand : colors.ink, alignItems: 'center', justifyContent: 'center' }}>
                <T v="caption" color={colors.white} style={{ fontFamily: fonts.bodyBold }}>{m.badge}</T>
              </View>
              <View style={{ flex: 1 }}>
                <T v="bodyBold">{m.label}</T>
                <T v="small">{m.sub}{on ? ' · default' : ''}</T>
              </View>
              <Radio selected={on} />
            </Pressable>
          );
        })}
      </View>
      {adding ? (
        <Card style={{ gap: 12 }}>
          <T v="title">Add a card</T>
          <Field label="Card number" value={number} onChangeText={(t) => setNumber(t.replace(/[^\d ]/g, '').slice(0, 19))} keyboardType="number-pad" placeholder="1234 5678 9012 3456" icon="credit-card-outline" />
          <Row gap={12}>
            <Field label="Expiry" value={expiry} onChangeText={(t) => setExpiry(t.replace(/[^\d/]/g, '').slice(0, 5))} placeholder="MM/YY" keyboardType="number-pad" style={{ flex: 1 }} />
            <Field label="CVC" value={cvc} onChangeText={(t) => setCvc(t.replace(/\D/g, '').slice(0, 4))} placeholder="123" keyboardType="number-pad" secureTextEntry style={{ flex: 1 }} />
          </Row>
          {error ? <T v="small" color={colors.danger}>{error}</T> : null}
          <Row gap={10}>
            <Button title="Cancel" variant="secondary" size="md" style={{ flex: 1 }} onPress={cancel} />
            <Button title="Save card" size="md" style={{ flex: 1 }} onPress={save} />
          </Row>
        </Card>
      ) : (
        <Button title="Add new card" icon="plus" variant="secondary" onPress={() => setAdding(true)} />
      )}
      <Banner icon="credit-card-clock-outline">For booking requests your payment stays pending the provider’s decision. It is released or refunded if they decline or don’t answer within 24 hours.</Banner>

      {role !== 'fan' || addingIban || payoutAccount ? (
        <View style={{ gap: 10 }}>
          <SectionTitle title="Payout account" />
          {payoutAccount ? (
            <Card style={{ gap: 4 }}>
              <T v="bodyBold">{payoutAccount.label}</T>
              <T v="small">{payoutAccount.sub} · used for provider payouts</T>
            </Card>
          ) : (
            <T v="small">Providers need a bank account to receive payouts for completed bookings.</T>
          )}
          {addingIban ? (
            <Card style={{ gap: 12 }}>
              <T v="title">Add a bank account (SEPA)</T>
              <Field label="IBAN" value={iban} onChangeText={(t) => { setIban(t.replace(/[^A-Za-z0-9 ]/g, '').slice(0, 42)); setIbanError(undefined); }} autoCapitalize="characters" placeholder="DE89 3704 0044 0532 0130 00" icon="bank-outline" />
              <Field label="Account holder" value={holder} onChangeText={(t) => { setHolder(t); setIbanError(undefined); }} placeholder="Name on the account" />
              {ibanError ? <T v="small" color={colors.danger}>{ibanError}</T> : null}
              <Row gap={10}>
                <Button title="Cancel" variant="secondary" size="md" style={{ flex: 1 }} onPress={() => { setAddingIban(false); setIbanError(undefined); if (params.iban === '1' && router.canGoBack()) router.back(); }} />
                <Button title="Save account" size="md" style={{ flex: 1 }} onPress={saveIban} />
              </Row>
            </Card>
          ) : !payoutAccount ? (
            <Button title="Add bank account" icon="bank-plus" variant="secondary" onPress={() => setAddingIban(true)} />
          ) : null}
        </View>
      ) : null}

      <Banner icon="lock-outline">Card and bank details are tokenised by our payment provider. Domtak never stores your full card number.</Banner>
    </Screen>
  );
}
