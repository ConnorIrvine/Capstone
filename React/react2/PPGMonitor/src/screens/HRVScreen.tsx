import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  StyleSheet,
  View,
  Text,
  Alert,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  ScrollView,
  Platform,
  ImageBackground,
} from 'react-native';
import {bleService} from '../services/BleService';
import {analyzeHRV, HRVResult} from '../services/HRVService';
import {saveSession} from '../services/SessionStorageService';
import {useAppContext} from '../context/AppContext';
import PPGChart from '../components/PPGChart';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

// Mirror of program.py check_hrv_status
function checkHRVStatus(current: number, previous: number | null): 0 | 1 | 2 {
  if (previous === null) return 1;
  const change = current - previous;
  if (change >= 0) return 0;      // GREEN: improving
  if (change > -5) return 1;      // YELLOW: slight drop
  return 2;                        // RED: significant drop ≥5ms
}

const HRV_FEEDBACK = [
  {color: '#00E676', bg: 'rgba(0,230,118,0.18)', symbol: '✓', message: 'EXCELLENT — HRV IMPROVING'},
  {color: '#FFD600', bg: 'rgba(255,214,0,0.18)',  symbol: '~', message: 'GOOD — SLIGHT DECREASE'},
  {color: '#FF5252', bg: 'rgba(255,82,82,0.18)',  symbol: '✗', message: 'REFOCUS — SIGNIFICANT DROP'},
] as const;

interface FeedbackInfo {
  status: 0 | 1 | 2;
  currentRmssd: number;
  previousRmssd: number | null;
  windowCount: number;
}

const CHART_WINDOW = 600;
const SAMPLING_RATE = 100;
const ROLLING_WINDOW_SEC = 30;
const ROLLING_WINDOW_SAMPLES = ROLLING_WINDOW_SEC * SAMPLING_RATE; // 3000
const UPDATE_INTERVAL_MS = 10_000; // 10 seconds
const MAX_HISTORY = 10;
const RATE_WINDOW_SEC = 5;

const HRVScreen: React.FC = () => {
  const [status, setStatus] = useState('Ready');
  const [isConnected, setIsConnected] = useState(bleService.connected);
  const [isRecording, setIsRecording] = useState(false);
  const isRecordingRef = useRef(false);
  const {apiUrl, exitSession} = useAppContext();
  const [hrvHistory, setHrvHistory] = useState<HRVResult[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [collectedSeconds, setCollectedSeconds] = useState(0);
  const [feedback, setFeedback] = useState<FeedbackInfo | null>(null);

  // Refs
  const latestHRVRef = useRef<HRVResult | undefined>(undefined);
  const previousRmssdRef = useRef<number | null>(null);
  const windowCountRef = useRef(0);
  const baselineRmssdRef = useRef<number | null>(null);
  const hadConnectionRef = useRef(bleService.connected);
  const disconnectHandledRef = useRef(false);
  const disconnectedDuringSessionRef = useRef(false);
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
  const recordingStartTimeRef = useRef<number>(0);

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
    if (!isRecordingRef.current) return;
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
    if (!isRecordingRef.current) {
      return;
    }
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
      // Update latest ref for session saving
      if (result.success) {
        latestHRVRef.current = result;
      }
      // Compute feedback status (mirrors program.py check_hrv_status)
      if (result.success && result.rmssd != null) {
        windowCountRef.current += 1;

        if (baselineRmssdRef.current === null) {
          baselineRmssdRef.current = result.rmssd;
        }

        const status = checkHRVStatus(result.rmssd, previousRmssdRef.current);
        setFeedback({
          status,
          currentRmssd: result.rmssd,
          previousRmssd: previousRmssdRef.current,
          windowCount: windowCountRef.current,
        });
        previousRmssdRef.current = result.rmssd;
      }
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
      const connected = newStatus.includes('Streaming');
      setIsConnected(connected);

      if (connected) {
        hadConnectionRef.current = true;
        disconnectHandledRef.current = false;
        return;
      }

      if (!hadConnectionRef.current || disconnectHandledRef.current) {
        return;
      }

      disconnectHandledRef.current = true;
      disconnectedDuringSessionRef.current = disconnectedDuringSessionRef.current || isRecordingRef.current;
      isRecordingRef.current = false;
      setIsRecording(false);
      setStatus('Connection lost');

      Alert.alert(
        'Device disconnected',
        'Connection lost. Returning to the main screen. This session was not saved.',
        [{text: 'OK', onPress: exitSession}],
        {cancelable: false},
      );
    });

    // Sync initial connection state
    if (bleService.connected) {
      setIsConnected(true);
    }

    return () => {
      bleService.removeOnData('hrv');
      bleService.removeOnStatusChange('hrv');
    };
  }, [handleData]);

  // Update the collected seconds counter and HRV timer only during an active session
  useEffect(() => {
    if (isConnected && isRecording) {
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
  }, [isConnected, isRecording, sendToAPI]);

  const handleRecording = useCallback(() => {
    if (isRecording) {
      if (disconnectedDuringSessionRef.current) {
        disconnectedDuringSessionRef.current = false;
        setStatus('Session canceled');
        return;
      }

      const endTime = Date.now();
      const durSeconds = Math.round((endTime - recordingStartTimeRef.current) / 1000);
      // Use ref to avoid stale closure on hrvHistory
      const latestRmssd = latestHRVRef.current?.rmssd;
      const baselineRmssd = baselineRmssdRef.current;
      const rmssdImprovementPct =
        baselineRmssd != null && latestRmssd != null && baselineRmssd > 0
          ? ((latestRmssd - baselineRmssd) / baselineRmssd) * 100
          : undefined;

      saveSession({
        id: recordingStartTimeRef.current.toString(),
        type: 'hrv',
        startTime: recordingStartTimeRef.current,
        endTime,
        durSeconds,
        rmssd: latestRmssd,
        baselineRmssd: baselineRmssd ?? undefined,
        endRmssd: latestRmssd,
        rmssdImprovementPct,
      });
      isRecordingRef.current = false;
      setIsRecording(false);
      setStatus('Session ended');
    } else {
      recordingStartTimeRef.current = Date.now();
      dataRef.current = [];
      rollingBufferRef.current = [];
      sampleCountRef.current = 0;
      statsRef.current = {totalSamples: 0, rate: 0, lastRxAge: 0};
      rateCounterRef.current = 0;
      rateWindowStartRef.current = Date.now();
      // Reset feedback state
      latestHRVRef.current = undefined;
      previousRmssdRef.current = null;
      windowCountRef.current = 0;
      baselineRmssdRef.current = null;
      disconnectedDuringSessionRef.current = false;
      setFeedback(null);
      setHrvHistory([]);
      setCollectedSeconds(0);
      isRecordingRef.current = true;
      setIsRecording(true);
      setStatus('Session active');
    }
  }, [isRecording]);

  const latestHRV = hrvHistory.find(h => h.success);

  return (
    <ImageBackground
      source={require('../assets/images/background2.jpg')}
      style={styles.container}
      resizeMode="cover">
      <View style={styles.bgOverlay} />
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollContainer}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity onPress={exitSession} style={styles.backBtn} activeOpacity={0.7}>
              <Icon name="arrow-left" size={26} color="#ffffff" />
            </TouchableOpacity>
            <Text style={styles.title}>HRV Analysis</Text>
          </View>
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

        {/* Chart */}
        <View style={styles.chartContainer}>
          <PPGChart
            width={screenWidth - 16}
            height={chartHeight}
            dataRef={dataRef}
            statsRef={statsRef}
            minimal
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

        {/* HRV Feedback Box — mirrors program.py display_feedback */}
        {feedback !== null && (() => {
          const fb = HRV_FEEDBACK[feedback.status];
          const change = feedback.previousRmssd !== null
            ? feedback.currentRmssd - feedback.previousRmssd
            : null;
          return (
            <View style={[styles.feedbackBox, {backgroundColor: fb.bg, borderColor: fb.color}]}>
              <View style={styles.feedbackLeft}>
                <Text style={[styles.feedbackSymbol, {color: fb.color}]}>{fb.symbol}</Text>
              </View>
              <View style={styles.feedbackBody}>
                <Text style={[styles.feedbackMessage, {color: fb.color}]}>{fb.message}</Text>
                <Text style={styles.feedbackDetail}>
                  RMSSD: {feedback.currentRmssd.toFixed(1)} ms
                  {change !== null ? `  |  Change: ${change >= 0 ? '+' : ''}${change.toFixed(1)} ms` : '  |  First reading'}
                </Text>
                <Text style={styles.feedbackWindow}>Window #{feedback.windowCount}</Text>
              </View>
            </View>
          );
        })()}

        {/* Record Button */}
        <TouchableOpacity
          style={[
            styles.button,
            isRecording ? styles.buttonStop : styles.buttonRecord,
            !isConnected && styles.buttonDisabled,
          ]}
          onPress={handleRecording}
          disabled={!isConnected}
          activeOpacity={0.7}>
          <Text style={styles.buttonText}>
            {isRecording ? 'End Session' : 'Start Session'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  bgOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,5,30,0.50)',
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
    fontSize: 26,
    fontWeight: '800',
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
    color: 'rgba(200, 180, 255, 0.75)',
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
    color: 'rgba(180, 160, 255, 0.65)',
    marginRight: 8,
    fontFamily: 'monospace',
  },
  apiInput: {
    flex: 1,
    backgroundColor: 'rgba(30, 20, 60, 0.7)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: '#e0d8ff',
    fontFamily: 'monospace',
    fontSize: 13,
    borderWidth: 1,
    borderColor: 'rgba(180, 150, 255, 0.3)',
  },
  chartContainer: {
    alignItems: 'center',
    marginVertical: 4,
  },
  hrvPanel: {
    backgroundColor: 'rgba(80, 55, 160, 0.65)',
    borderRadius: 14,
    padding: 14,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(180, 150, 255, 0.25)',
  },
  hrvTitle: {
    fontSize: 13,
    color: 'rgba(200, 180, 255, 0.7)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    fontWeight: '600',
  },
  currentHRV: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  hrvValue: {
    fontSize: 52,
    fontWeight: '800',
    color: '#00E676',
    fontFamily: 'monospace',
  },
  hrvUnit: {
    fontSize: 22,
    color: '#00E676',
    marginLeft: 8,
    fontFamily: 'monospace',
  },
  hrvWaiting: {
    fontSize: 15,
    color: 'rgba(180, 160, 255, 0.6)',
    fontFamily: 'monospace',
    textAlign: 'center',
  },
  analyzingText: {
    fontSize: 12,
    color: 'rgba(200, 180, 255, 0.7)',
    textAlign: 'center',
    marginTop: 4,
    fontFamily: 'monospace',
  },
  historySection: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(180, 150, 255, 0.2)',
    paddingTop: 10,
  },
  historyTitle: {
    fontSize: 12,
    color: 'rgba(200, 180, 255, 0.6)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    fontWeight: '600',
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  historyTime: {
    fontSize: 12,
    color: 'rgba(180, 160, 255, 0.6)',
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
    color: 'rgba(160, 140, 220, 0.55)',
    fontFamily: 'monospace',
    width: 80,
    textAlign: 'right',
  },
  button: {
    marginTop: 8,
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  buttonRecord: {
    backgroundColor: 'rgba(0, 200, 83, 0.9)',
  },
  buttonStop: {
    backgroundColor: 'rgba(255, 82, 82, 0.9)',
  },
  buttonDisabled: {
    opacity: 0.35,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  // Header back button
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  backBtn: {padding: 4},
  // HRV Feedback Box
  feedbackBox: {
    borderRadius: 14,
    borderWidth: 2,
    padding: 16,
    marginVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  feedbackLeft: {
    width: 48,
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  feedbackSymbol: {
    fontSize: 26,
    fontWeight: '900',
  },
  feedbackBody: {
    flex: 1,
    gap: 3,
  },
  feedbackMessage: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  feedbackDetail: {
    fontSize: 13,
    color: 'rgba(220, 200, 255, 0.85)',
    fontFamily: 'monospace',
  },
  feedbackWindow: {
    fontSize: 11,
    color: 'rgba(180, 160, 255, 0.55)',
    fontFamily: 'monospace',
    marginTop: 2,
  },
});

export default HRVScreen;
