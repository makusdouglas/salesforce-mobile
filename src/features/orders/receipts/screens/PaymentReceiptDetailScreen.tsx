import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

// 012-payment-receipts Phase 1 placeholder. Real implementation lands in
// Phase 5 (T045) and gains the attachment viewer in Phase 6 (T052).
export function PaymentReceiptDetailScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.body}>
        <Text style={styles.title}>PaymentReceiptDetailScreen</Text>
        <Text style={styles.sub}>Placeholder · Phase 1 · 012-payment-receipts</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FAFAFA' },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 18, fontWeight: '600', color: '#0A0A0A' },
  sub: { marginTop: 8, fontSize: 12, color: '#737373' },
});
