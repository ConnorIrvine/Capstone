import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useBLEContext } from '../context/BLEContext';
import { PPGChart } from '../components/PPGChart';
import { RootStackParamList } from '../../App';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Data'>;

const RATE_WINDOW_MS = 1000; // how often to recalculate sample rate

export function DataScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { connectedDeviceId, ppgData, disconnectFromDevice } = useBLEContext();

  // Track sample rate (samples/sec)
  const [sampleRate, setSampleRate] = useState(0);
  const prevLengthRef = useRef(0);
  const prevTimestampRef = useRef(Date.now());

  // Navigate back when device disconnects unexpectedly
  useEffect(() => {
    if (!connectedDeviceId) {
      navigation.navigate('Connect');
    }
  }, [connectedDeviceId, navigation]);

  // Compute incoming sample rate every second
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = (now - prevTimestampRef.current) / 1000;
      const added = ppgData.length - prevLengthRef.current;

      setSampleRate(elapsed > 0 ? Math.round(added / elapsed) : 0);

      prevLengthRef.current = ppgData.length;
      prevTimestampRef.current = now;
    }, RATE_WINDOW_MS);

    return () => clearInterval(interval);
  }, [ppgData]);

  const currentValue = ppgData.length > 0 ? ppgData[ppgData.length - 1] : null;

  const handleDisconnect = () => {
    Alert.alert(
      'Disconnect',
      'Disconnect from the Arduino sensor?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: disconnectFromDevice,
        },
      ],
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.connectedBadge}>
            <View style={styles.connectedDot} />
            <Text style={styles.connectedText}>Connected</Text>
          </View>
          <Text style={styles.headerTitle}>PPG Signal</Text>
        </View>
        <TouchableOpacity
          style={styles.disconnectButton}
          onPress={handleDisconnect}
          accessibilityLabel="Disconnect from device"
        >
          <Text style={styles.disconnectButtonText}>Disconnect</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Stats row */}
        <View style={styles.statsRow}>
          <StatCard
            label="Current Value"
            value={currentValue != null ? currentValue.toString() : '—'}
            unit="ADC"
          />
          <StatCard
            label="Sample Rate"
            value={sampleRate.toString()}
            unit="Hz"
          />
          <StatCard
            label="Buffer"
            value={ppgData.length.toString()}
            unit="pts"
          />
        </View>

        {/* Live chart */}
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Live PPG Waveform</Text>
          {ppgData.length < 2 ? (
            <View style={styles.chartPlaceholder}>
              <Text style={styles.chartPlaceholderText}>
                Waiting for data from sensor…
              </Text>
            </View>
          ) : (
            <PPGChart data={ppgData} height={220} />
          )}
        </View>

        {/* Info card */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Signal Info</Text>
          <InfoRow label="Device" value="NanoESP32_PPG" />
          <InfoRow label="Sensor" value="Pulse sensor (A0)" />
          <InfoRow label="ADC Range" value="0 – 4095  (12-bit)" />
          <InfoRow label="Sample Rate" value="100 Hz (target)" />
          <InfoRow label="Chart Window" value="5 seconds" />
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <View style={statStyles.card}>
      <Text style={statStyles.value}>{value}</Text>
      <Text style={statStyles.unit}>{unit}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={infoStyles.row}>
      <Text style={infoStyles.label}>{label}</Text>
      <Text style={infoStyles.value}>{value}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  headerLeft: {
    flex: 1,
  },
  connectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  connectedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
    marginRight: 6,
  },
  connectedText: {
    color: '#22c55e',
    fontSize: 12,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#f1f5f9',
  },
  disconnectButton: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dc2626',
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  disconnectButtonText: {
    color: '#dc2626',
    fontSize: 13,
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  chartCard: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 16,
    marginBottom: 16,
  },
  chartTitle: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  chartPlaceholder: {
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartPlaceholderText: {
    color: '#475569',
    fontSize: 14,
  },
  infoCard: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 16,
  },
  infoTitle: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
});

const statStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 12,
    alignItems: 'center',
  },
  value: {
    color: '#22d3ee',
    fontSize: 22,
    fontWeight: '700',
  },
  unit: {
    color: '#475569',
    fontSize: 11,
    marginTop: 1,
  },
  label: {
    color: '#64748b',
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center',
  },
});

const infoStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#1e3a4a',
  },
  label: {
    color: '#64748b',
    fontSize: 13,
  },
  value: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'right',
  },
});
