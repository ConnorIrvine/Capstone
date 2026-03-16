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
import {analyzeHRV, HRVResult} from '../services/HRVService';
import PPGChart from '../components/PPGChart';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const CHART_WINDOW = 600;
const SAMPLING_RATE = 100;
const ROLLING_WINDOW_SEC = 30;
const ROLLING_WINDOW_SAMPLES = ROLLING_WINDOW_SEC * SAMPLING_RATE; // 3000
const UPDATE_INTERVAL_MS = 10_000; // 10 seconds
const MAX_HISTORY = 10;
const RATE_WINDOW_SEC = 5;

const HRVScreen: React.FC = () => {
  const [status, setStatus] = useState('Idle');
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [apiUrl, setApiUrl] = useState('http://192.168.137.1:8000');
  const [hrvHistory, setHrvHistory] = useState<HRVResult[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [collectedSeconds, setCollectedSeconds] = useState(0);

  // Data refs for chart rendering (last 600 samples)
  const dataRef = useRef<number[]>([]);
  const statsRef = useRef({totalSamples: 0, rate: 0, lastRxAge: 0});

  // Rolling buffer for HRV analysis (last 30 seconds)
  const rollingBufferRef = useRef<number[]>([]);
  const sampleCountRef = useRef(0);

  // Rate tracking
  const rateCounterRef = useRef(0);
  const rateWindowStartRef = useRef(Date.now());
  const lastRxTimeRef = useRef(0);

  // Timer refs
  const updateTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const collectTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const screenWidth = Dimensions.get('window').width;
  const chartHeight = 220;

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
      if (elapsed >= RATE_WINDOW_SEC) {
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

    // Update rolling buffer for HRV
    const rolling = rollingBufferRef.current;
    for (let i = 0; i < samples.length; i++) {
      rolling.push(samples[i]);
    }
    if (rolling.length > ROLLING_WINDOW_SAMPLES + 500) {
      rollingBufferRef.current = rolling.slice(-ROLLING_WINDOW_SAMPLES);
    }

    // Update stats
    statsRef.current.totalSamples += samples.length;
    rateCounterRef.current += samples.length;
    lastRxTimeRef.current = Date.now();
    sampleCountRef.current += samples.length;
  }, []);

  // Send data to API for HRV analysis
  const sendToAPI = useCallback(async () => {
    const buffer = rollingBufferRef.current;
    console.log('[HRV] sendToAPI called, buffer length:', buffer.length, '/', ROLLING_WINDOW_SAMPLES);
    if (buffer.length < ROLLING_WINDOW_SAMPLES) {
      return; // Not enough data yet
    }

    const windowData = buffer.slice(-ROLLING_WINDOW_SAMPLES);
    setIsAnalyzing(true);
    console.log('[HRV] Sending', windowData.length, 'samples to', apiUrl);
    try {
      const result = await analyzeHRV(apiUrl, windowData, SAMPLING_RATE, 1);
      console.log('[HRV] Result:', JSON.stringify(result));
      setHrvHistory(prev => [result, ...prev].slice(0, MAX_HISTORY));
    } catch (e: any) {
      console.log('[HRV] Error:', e.message);
      const errorResult: HRVResult = {
        success: false,
        bad_segments: 0,
        error: e.message || 'Network error',
        timestamp: Date.now(),
      };
      setHrvHistory(prev => [errorResult, ...prev].slice(0, MAX_HISTORY));
    } finally {
      setIsAnalyzing(false);
    }
  }, [apiUrl]);

  // Register BLE listener and start HRV update timer
  useEffect(() => {
    bleService.addOnData('hrv', handleData);
    bleService.addOnStatusChange('hrv', (newStatus: string) => {
      setStatus(newStatus);
      const connected = newStatus.includes('Streaming');
      setIsConnected(connected);
      if (!connected) {
        setIsConnecting(false);
      }
    });

    // Sync initial connection state
    if (bleService.connected) {
      setIsConnected(true);
      setStatus('Connected. Streaming...');
    }

    return () => {
      bleService.removeOnData('hrv');
      bleService.removeOnStatusChange('hrv');
    };
  }, [handleData]);

  // Update the collected seconds counter and start HRV timer once connected
  useEffect(() => {
    if (isConnected) {
      // Track how many seconds of data we have
      collectTimerRef.current = setInterval(() => {
        const secs = Math.floor(sampleCountRef.current / SAMPLING_RATE);
        setCollectedSeconds(secs);
      }, 1000);

      // Start HRV analysis timer: every 10 seconds, send last 30s to API
      updateTimerRef.current = setInterval(() => {
        sendToAPI();
      }, UPDATE_INTERVAL_MS);
    } else {
      // Clear timers on disconnect
      if (updateTimerRef.current) {
        clearInterval(updateTimerRef.current);
        updateTimerRef.current = null;
      }
      if (collectTimerRef.current) {
        clearInterval(collectTimerRef.current);
        collectTimerRef.current = null;
      }
    }

    return () => {
      if (updateTimerRef.current) {
        clearInterval(updateTimerRef.current);
        updateTimerRef.current = null;
      }
      if (collectTimerRef.current) {
        clearInterval(collectTimerRef.current);
        collectTimerRef.current = null;
      }
    };
  }, [isConnected, sendToAPI]);

  const handleConnect = useCallback(async () => {
    if (isConnected) {
      await bleService.disconnect();
      setIsConnected(false);
      return;
    }

    setIsConnecting(true);
    // Reset data on new connection
    dataRef.current = [];
    rollingBufferRef.current = [];
    sampleCountRef.current = 0;
    statsRef.current = {totalSamples: 0, rate: 0, lastRxAge: 0};
    rateCounterRef.current = 0;
    rateWindowStartRef.current = Date.now();
    setHrvHistory([]);
    setCollectedSeconds(0);

    try {
      await bleService.scanAndConnect();
    } catch (_error) {
      setIsConnecting(false);
    }
  }, [isConnected]);

  const latestHRV = hrvHistory.find(h => h.success);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0d0d1a" />

      <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollContainer}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>HRV Analysis</Text>
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
            value={apiUrl}
            onChangeText={setApiUrl}
            placeholder="http://192.168.1.100:8000"
            placeholderTextColor="#444466"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* Chart */}
        <View style={styles.chartContainer}>
          <PPGChart
            width={screenWidth - 16}
            height={chartHeight}
            dataRef={dataRef}
            statsRef={statsRef}
          />
        </View>

        {/* HRV Display */}
        <View style={styles.hrvPanel}>
          <Text style={styles.hrvTitle}>Heart Rate Variability (RMSSD)</Text>

          {/* Current HRV */}
          <View style={styles.currentHRV}>
            {latestHRV ? (
              <>
                <Text style={styles.hrvValue}>
                  {latestHRV.rmssd?.toFixed(1)}
                </Text>
                <Text style={styles.hrvUnit}>ms</Text>
              </>
            ) : (
              <Text style={styles.hrvWaiting}>
                {isConnected
                  ? collectedSeconds < ROLLING_WINDOW_SEC
                    ? `Collecting data... ${collectedSeconds}/${ROLLING_WINDOW_SEC}s`
                    : isAnalyzing
                    ? 'Analyzing...'
                    : 'Waiting for first result...'
                  : 'Connect to start'}
              </Text>
            )}
          </View>

          {isAnalyzing && latestHRV && (
            <Text style={styles.analyzingText}>Analyzing...</Text>
          )}

          {/* History */}
          {hrvHistory.length > 0 && (
            <View style={styles.historySection}>
              <Text style={styles.historyTitle}>Recent Readings</Text>
              {hrvHistory.map((item, index) => (
                <View key={item.timestamp} style={styles.historyRow}>
                  <Text style={styles.historyTime}>
                    {new Date(item.timestamp).toLocaleTimeString()}
                  </Text>
                  {item.success ? (
                    <Text style={styles.historyValue}>
                      {item.rmssd?.toFixed(1)} ms
                    </Text>
                  ) : (
                    <Text style={styles.historyError}>
                      {item.error}
                    </Text>
                  )}
                  <Text style={styles.historySegments}>
                    {item.bad_segments > 0
                      ? `${item.bad_segments} bad seg`
                      : ''}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

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
              ? 'Disconnect'
              : 'Connect'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

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
  hrvPanel: {
    backgroundColor: '#16162a',
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
  },
  hrvTitle: {
    fontSize: 13,
    color: '#6666aa',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  currentHRV: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  hrvValue: {
    fontSize: 48,
    fontWeight: '700',
    color: '#00E676',
    fontFamily: 'monospace',
  },
  hrvUnit: {
    fontSize: 20,
    color: '#00E676',
    marginLeft: 6,
    fontFamily: 'monospace',
  },
  hrvWaiting: {
    fontSize: 16,
    color: '#6666aa',
    fontFamily: 'monospace',
  },
  analyzingText: {
    fontSize: 12,
    color: '#aaaacc',
    textAlign: 'center',
    marginTop: 4,
    fontFamily: 'monospace',
  },
  historySection: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#2a2a4a',
    paddingTop: 10,
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
    flex: 1,
  },
  historyValue: {
    fontSize: 14,
    color: '#00E676',
    fontFamily: 'monospace',
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  historyError: {
    fontSize: 12,
    color: '#FF5252',
    fontFamily: 'monospace',
    flex: 1,
    textAlign: 'right',
  },
  historySegments: {
    fontSize: 11,
    color: '#8888aa',
    fontFamily: 'monospace',
    width: 80,
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

export default HRVScreen;
