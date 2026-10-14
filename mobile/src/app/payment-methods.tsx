import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Screen, ScreenHeader } from '../components/layout';
import { Banner, Button, Card, Field, Radio, Row, T } from '../components/ui';
import { toast } from '../store/toast';
import { useApp } from '../store/useApp';
import { colors, fonts, radius } from '../theme';

export default function PaymentMethods() {
  const params = useLocalSearchParams<{ add?: string; payout?: string }>();
  const methods = useApp((s) => s.paymentMethods);
  const selected = useApp((s) => s.selectedPayment);
  const setSelected = useApp((s) => s.setSelectedPayment);
  const addMethod = useApp((s) => s.addPaymentMethod);
  const [adding, setAdding] = useState(params.add === '1');
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
      <Banner icon="lock-outline">Card details are tokenised by our payment provider (e.g. Stripe) — Domtak never stores your full card number.</Banner>
    </Screen>
  );
}
