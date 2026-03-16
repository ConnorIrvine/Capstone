import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  TextInput,
  ScrollView,
  Platform,
} from 'react-native';
import {bleService} from '../services/BleService';
import {
  amplitudeStart,
  amplitudeSendData,
  amplitudeStop,
  AmplitudeEvent,
  AmplitudeStopResult,
} from '../services/AmplitudeService';
import PPGChart from '../components/PPGChart';
import AmplitudeCharts, {AmplitudeChartsData} from '../components/AmplitudeCharts';
import {initSounds, playFeedbackSound, releaseSounds} from '../services/SoundService';

const CHART_WINDOW = 600;
const SEND_INTERVAL_MS = 1000; // send data every 1 second
const MAX_EVENT_HISTORY = 20;

const FEEDBACK_COLORS: Record<string, string> = {
  green: '#00E676',
  yellow: '#FFD600',
  red: '#FF5252',
};

const AmplitudeScreen: React.FC = () => {
  const [status, setStatus] = useState('Idle');
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [apiUrl, setApiUrl] = useState('http://192.168.137.1:8000');
  const [pendingApiUrl, setPendingApiUrl] = useState(apiUrl);
  const [apiUrlError, setApiUrlError] = useState<string | null>(null);

  // Debounce API URL changes
  useEffect(() => {
    const handler = setTimeout(() => {
      // Simple validation: must start with http:// or https://
      if (/^https?:\/\//.test(pendingApiUrl)) {
        setApiUrl(pendingApiUrl);
        setApiUrlError(null);
      } else {
        setApiUrlError('Invalid URL format');
      }
    }, 500);
    return () => clearTimeout(handler);
  }, [pendingApiUrl]);
  const [currentHR, setCurrentHR] = useState<number | null>(null);
  const [latestAmplitude, setLatestAmplitude] = useState<number | null>(null);
  const [latestColor, setLatestColor] = useState<string>('green');
  const [latestBreathingRate, setLatestBreathingRate] = useState<number | null>(null);
  const [signalQuality, setSignalQuality] = useState('ACTIVE');
  const [eventHistory, setEventHistory] = useState<AmplitudeEvent[]>([]);
  const [summary, setSummary] = useState<AmplitudeStopResult | null>(null);

  // Data refs
  const dataRef = useRef<number[]>([]);
  const statsRef = useRef({totalSamples: 0, rate: 0, lastRxAge: 0});

  // Pending samples buffer — accumulated between sends
  const pendingSamplesRef = useRef<number[]>([]);
  const sessionIdRef = useRef<string | null>(null);

  // Chart data ref for AmplitudeCharts
  const chartDataRef = useRef<AmplitudeChartsData>({hrSeries: [], events: []});

  // Rate tracking
  const rateCounterRef = useRef(0);
  const rateWindowStartRef = useRef(Date.now());
  const lastRxTimeRef = useRef(0);

  // Timer refs
  const sendTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const screenWidth = Dimensions.get('window').width;
  const chartHeight = 110;

  // Load sounds
  useEffect(() => {
    initSounds();
    return () => releaseSounds();
  }, []);

  // Rate calculation interval
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = (now - rateWindowStartRef.current) / 1000;
      if (elapsed > 0) {
        statsRef.current.rate = rateCounterRef.current / elapsed;
      }
      if (lastRxTimeRef.current > 0) {
        statsRef.current.lastRxAge = (now - lastRxTimeRef.current) / 1000;
      }
      if (elapsed >= 5) {
        rateCounterRef.current = 0;
        rateWindowStartRef.current = now;
      }
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Handle incoming PPG data
  const handleData = useCallback((samples: number[]) => {
    // Update chart buffer
    const data = dataRef.current;
    for (let i = 0; i < samples.length; i++) {
      data.push(samples[i]);
    }
    if (data.length > CHART_WINDOW + 100) {
      dataRef.current = data.slice(-CHART_WINDOW);
    }

    // Accumulate for API send
    const pending = pendingSamplesRef.current;
    for (let i = 0; i < samples.length; i++) {
      pending.push(samples[i]);
    }

    // Update stats
    statsRef.current.totalSamples += samples.length;
    rateCounterRef.current += samples.length;
    lastRxTimeRef.current = Date.now();
  }, []);

  // Send accumulated samples to API
  const sendPending = useCallback(async () => {
    const sid = sessionIdRef.current;
    if (!sid) {
      return;
    }

    const samples = pendingSamplesRef.current;
    if (samples.length === 0) {
      return;
    }
    // Take and clear
    pendingSamplesRef.current = [];

    try {
      const result = await amplitudeSendData(apiUrl, sid, samples);
      if (result.hr != null) {
        setCurrentHR(result.hr);
      }
      setSignalQuality(result.signal_quality);

      // Accumulate HR data for charts
      if (result.hr_data && result.hr_data.length > 0) {
        const cd = chartDataRef.current;
        cd.hrSeries = cd.hrSeries.concat(result.hr_data);
      }

      if (result.events.length > 0) {
        // Accumulate events for charts
        const cd = chartDataRef.current;
        cd.events = cd.events.concat(result.events);

        const latest = result.events[result.events.length - 1];
        playFeedbackSound(latest.feedback_color);
        setLatestAmplitude(latest.amplitude);
        setLatestColor(latest.feedback_color);
        setLatestBreathingRate(latest.breathing_rate_bpm);
        setEventHistory(prev =>
          [...result.events, ...prev].slice(0, MAX_EVENT_HISTORY),
        );
      }
    } catch (e: any) {
      console.log('[Amplitude] send error:', e.message);
    }
  }, [apiUrl]);

  // Register BLE listener
  useEffect(() => {
    bleService.addOnData('amplitude', handleData);
    bleService.addOnStatusChange('amplitude', (newStatus: string) => {
      setStatus(newStatus);
      const connected = newStatus.includes('Streaming');
      setIsConnected(connected);
      if (!connected) {
        setIsConnecting(false);
      }
    });

    if (bleService.connected) {
      setIsConnected(true);
      setStatus('Connected. Streaming...');
    }

    return () => {
      bleService.removeOnData('amplitude');
      bleService.removeOnStatusChange('amplitude');
    };
  }, [handleData]);

  // Start/stop send timer based on connection + session
  useEffect(() => {
    if (isConnected && sessionIdRef.current) {
      sendTimerRef.current = setInterval(() => {
        sendPending();
      }, SEND_INTERVAL_MS);
    } else {
      if (sendTimerRef.current) {
        clearInterval(sendTimerRef.current);
        sendTimerRef.current = null;
      }
    }

    return () => {
      if (sendTimerRef.current) {
        clearInterval(sendTimerRef.current);
        sendTimerRef.current = null;
      }
    };
  }, [isConnected, sendPending]);

  const handleConnect = useCallback(async () => {
    if (isConnected) {
      // Stop session first
      if (sessionIdRef.current) {
        try {
          const stopResult = await amplitudeStop(apiUrl, sessionIdRef.current);
          setSummary(stopResult);
        } catch (e: any) {
          console.log('[Amplitude] stop error:', e.message);
        }
        sessionIdRef.current = null;
      }
      await bleService.disconnect();
      setIsConnected(false);
      // Reset rate stats so PPG viewer stops counting
      statsRef.current = {totalSamples: statsRef.current.totalSamples, rate: 0, lastRxAge: 0};
      lastRxTimeRef.current = 0;
      rateCounterRef.current = 0;
      return;
    }

    setIsConnecting(true);
    setSummary(null);
    // Reset state
    dataRef.current = [];
    pendingSamplesRef.current = [];
    chartDataRef.current = {hrSeries: [], events: []};
    statsRef.current = {totalSamples: 0, rate: 0, lastRxAge: 0};
    rateCounterRef.current = 0;
    rateWindowStartRef.current = Date.now();
    setCurrentHR(null);
    setLatestAmplitude(null);
    setLatestColor('green');
    setLatestBreathingRate(null);
    setSignalQuality('ACTIVE');
    setEventHistory([]);

    try {
      // Start API session
      const sid = await amplitudeStart(apiUrl);
      sessionIdRef.current = sid;
      console.log('[Amplitude] session started:', sid);

      // Connect BLE
      await bleService.scanAndConnect();
    } catch (e: any) {
      console.log('[Amplitude] connect error:', e.message);
      setIsConnecting(false);
      sessionIdRef.current = null;
    }
  }, [isConnected, apiUrl]);

  const isBadSignal = signalQuality.includes('PAUSED');

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0d0d1a" />

      <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollContainer}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>HR Amplitude</Text>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusDot,
                {backgroundColor: isConnected ? '#00E676' : '#FF5252'},
              ]}
            />
            <Text style={styles.statusText}>{status}</Text>
          </View>
        </View>

        {/* API URL Input */}
        <View style={styles.apiRow}>
          <Text style={styles.apiLabel}>API URL:</Text>
          <TextInput
            style={styles.apiInput}
            value={pendingApiUrl}
            onChangeText={setPendingApiUrl}
            placeholder="http://192.168.1.100:8000"
            placeholderTextColor="#444466"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {apiUrlError && (
            <Text style={{ color: '#FF5252', fontSize: 12, marginTop: 2 }}>{apiUrlError}</Text>
          )}
        </View>

        {/* PPG Chart */}
        <View style={styles.chartContainer}>
          <PPGChart
            width={screenWidth - 16}
            height={chartHeight}
            dataRef={dataRef}
            statsRef={statsRef}
          />
        </View>

        {/* HR / Amplitude / Breathing Rate Charts */}
        <View style={styles.chartContainer}>
          <AmplitudeCharts
            viewportWidth={screenWidth - 16}
            height={400}
            dataRef={chartDataRef}
            isStreaming={isConnected}
          />
        </View>

        {/* Signal Quality Badge */}
        <View style={[styles.sqiBadge, isBadSignal && styles.sqiBadgeBad]}>
          <Text style={[styles.sqiText, isBadSignal && styles.sqiTextBad]}>
            {signalQuality}
          </Text>
        </View>

        {/* Live Metrics Panel */}
        <View style={styles.metricsPanel}>
          {/* HR */}
          <View style={styles.metricBox}>
            <Text style={styles.metricLabel}>HEART RATE</Text>
            {currentHR != null ? (
              <View style={styles.metricRow}>
                <Text style={styles.metricValue}>{currentHR.toFixed(0)}</Text>
                <Text style={styles.metricUnit}>bpm</Text>
              </View>
            ) : (
              <Text style={styles.metricWaiting}>--</Text>
            )}
          </View>

          {/* Amplitude circle */}
          <View style={styles.metricBox}>
            <Text style={styles.metricLabel}>AMPLITUDE</Text>
            {latestAmplitude != null ? (
              <View
                style={[
                  styles.amplitudeCircle,
                  {borderColor: FEEDBACK_COLORS[latestColor]},
                ]}>
                <Text
                  style={[
                    styles.amplitudeValue,
                    {color: FEEDBACK_COLORS[latestColor]},
                  ]}>
                  {latestAmplitude.toFixed(1)}
                </Text>
                <Text
                  style={[
                    styles.amplitudeUnit,
                    {color: FEEDBACK_COLORS[latestColor]},
                  ]}>
                  BPM
                </Text>
              </View>
            ) : (
              <Text style={styles.metricWaiting}>--</Text>
            )}
          </View>

          {/* Breathing Rate */}
          <View style={styles.metricBox}>
            <Text style={styles.metricLabel}>BREATHING</Text>
            {latestBreathingRate != null ? (
              <View style={styles.metricRow}>
                <Text style={styles.metricValue}>
                  {latestBreathingRate.toFixed(1)}
                </Text>
                <Text style={styles.metricUnit}>br/min</Text>
              </View>
            ) : (
              <Text style={styles.metricWaiting}>--</Text>
            )}
          </View>
        </View>

        {/* Session Summary (shown after disconnect) */}
        {summary && (
          <View style={styles.summaryPanel}>
            <Text style={styles.summaryTitle}>SESSION SUMMARY</Text>
            <SummaryRow label="Total Samples" value={summary.total_samples.toString()} />
            <SummaryRow label="Amplitude Events" value={summary.total_amplitude_events.toString()} />
            {summary.mean_hr != null && (
              <>
                <SummaryRow label="Mean HR" value={`${summary.mean_hr.toFixed(1)} bpm`} />
                <SummaryRow label="Min HR" value={`${summary.min_hr!.toFixed(1)} bpm`} />
                <SummaryRow label="Max HR" value={`${summary.max_hr!.toFixed(1)} bpm`} />
              </>
            )}
            {summary.mean_amplitude != null && (
              <>
                <SummaryRow label="Mean Amplitude" value={`${summary.mean_amplitude.toFixed(2)} BPM`} />
                <SummaryRow label="Min Amplitude" value={`${summary.min_amplitude!.toFixed(2)} BPM`} />
                <SummaryRow label="Max Amplitude" value={`${summary.max_amplitude!.toFixed(2)} BPM`} />
              </>
            )}
            {summary.mean_breathing_rate != null && (
              <SummaryRow
                label="Mean Breathing Rate"
                value={`${summary.mean_breathing_rate.toFixed(1)} br/min`}
              />
            )}
          </View>
        )}

        {/* Event History */}
        {eventHistory.length > 0 && (
          <View style={styles.historySection}>
            <Text style={styles.historyTitle}>Recent Amplitude Events</Text>
            {eventHistory.map((ev, index) => (
              <View key={`${ev.time_s}-${index}`} style={styles.historyRow}>
                <Text style={styles.historyTime}>{ev.time_s.toFixed(1)}s</Text>
                <Text
                  style={[
                    styles.historyValue,
                    {color: FEEDBACK_COLORS[ev.feedback_color]},
                  ]}>
                  {ev.amplitude.toFixed(1)} BPM
                </Text>
                <Text style={styles.historyBreathing}>
                  {ev.breathing_rate_bpm.toFixed(1)} br/min
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Connect Button */}
        <TouchableOpacity
          style={[
            styles.button,
            isConnected ? styles.buttonDisconnect : styles.buttonConnect,
            isConnecting && styles.buttonDisabled,
          ]}
          onPress={handleConnect}
          disabled={isConnecting}
          activeOpacity={0.7}>
          <Text style={styles.buttonText}>
            {isConnecting
              ? 'Connecting...'
              : isConnected
              ? 'Stop & Disconnect'
              : 'Connect'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const SummaryRow: React.FC<{label: string; value: string}> = ({label, value}) => (
  <View style={styles.summaryRow}>
    <Text style={styles.summaryLabel}>{label}</Text>
    <Text style={styles.summaryValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0d1a',
  },
  scrollContent: {
    flex: 1,
    paddingHorizontal: 8,
  },
  scrollContainer: {
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 8 : 16,
    paddingBottom: 24,
  },
  header: {
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 13,
    color: '#aaaacc',
    fontFamily: 'monospace',
  },
  apiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  apiLabel: {
    fontSize: 12,
    color: '#6666aa',
    marginRight: 8,
    fontFamily: 'monospace',
  },
  apiInput: {
    flex: 1,
    backgroundColor: '#16162a',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: '#ccccee',
    fontFamily: 'monospace',
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  chartContainer: {
    alignItems: 'center',
    marginVertical: 4,
  },
  sqiBadge: {
    alignSelf: 'center',
    backgroundColor: '#16162a',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: '#00E676',
  },
  sqiBadgeBad: {
    borderColor: '#FF5252',
    backgroundColor: '#2a1020',
  },
  sqiText: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#00E676',
    fontWeight: '600',
  },
  sqiTextBad: {
    color: '#FF5252',
  },
  metricsPanel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 8,
    paddingHorizontal: 4,
  },
  metricBox: {
    flex: 1,
    backgroundColor: '#16162a',
    borderRadius: 8,
    padding: 10,
    marginHorizontal: 3,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 10,
    color: '#6666aa',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  metricValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ccccee',
    fontFamily: 'monospace',
  },
  metricUnit: {
    fontSize: 12,
    color: '#8888aa',
    marginLeft: 3,
    fontFamily: 'monospace',
  },
  metricWaiting: {
    fontSize: 28,
    color: '#444466',
    fontFamily: 'monospace',
    fontWeight: '700',
  },
  amplitudeCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  amplitudeValue: {
    fontSize: 22,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  amplitudeUnit: {
    fontSize: 10,
    fontFamily: 'monospace',
  },
  summaryPanel: {
    backgroundColor: '#16162a',
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  summaryTitle: {
    fontSize: 13,
    color: '#6666aa',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    fontWeight: '600',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  summaryLabel: {
    fontSize: 13,
    color: '#8888aa',
    fontFamily: 'monospace',
  },
  summaryValue: {
    fontSize: 13,
    color: '#ccccee',
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  historySection: {
    backgroundColor: '#16162a',
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
  },
  historyTitle: {
    fontSize: 12,
    color: '#6666aa',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  historyTime: {
    fontSize: 12,
    color: '#8888aa',
    fontFamily: 'monospace',
    width: 60,
  },
  historyValue: {
    fontSize: 14,
    fontFamily: 'monospace',
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  historyBreathing: {
    fontSize: 12,
    color: '#8888aa',
    fontFamily: 'monospace',
    width: 90,
    textAlign: 'right',
  },
  button: {
    marginTop: 8,
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonConnect: {
    backgroundColor: '#00C853',
  },
  buttonDisconnect: {
    backgroundColor: '#FF5252',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
});

export default AmplitudeScreen;
