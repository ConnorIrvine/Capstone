import React, {useCallback, useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  ImageBackground,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  loadSessions,
  groupByWeek,
  formatDuration,
  formatWeekLabel,
  Session,
} from '../services/SessionStorageService';

interface Props {
  onBack: () => void;
}

interface WeekStats {
  sessionCount: number;
  totalSeconds: number;
  avgRmssd: number | null;
  avgHR: number | null;
  weekLabel: string;
  sessions: Session[];
}

function computeStats(groups: {weekStart: Date; sessions: Session[]}[]): WeekStats | null {
  if (groups.length === 0) return null;
  const {weekStart, sessions} = groups[0];
  const totalSeconds = sessions.reduce((s, x) => s + x.durSeconds, 0);
  const rmssdVals = sessions.filter(s => s.rmssd != null).map(s => s.rmssd as number);
  const hrVals = sessions.filter(s => s.meanHR != null).map(s => s.meanHR as number);
  return {
    sessionCount: sessions.length,
    totalSeconds,
    avgRmssd: rmssdVals.length > 0 ? rmssdVals.reduce((a, b) => a + b, 0) / rmssdVals.length : null,
    avgHR: hrVals.length > 0 ? hrVals.reduce((a, b) => a + b, 0) / hrVals.length : null,
    weekLabel: formatWeekLabel(weekStart),
    sessions,
  };
}

function hrColor(hr: number | null): string {
  if (hr == null) return '#aaaacc';
  if (hr < 60) return '#64B5F6';
  if (hr < 100) return '#00E676';
  return '#FF7043';
}

function rmssdColor(rmssd: number | null): string {
  if (rmssd == null) return '#aaaacc';
  if (rmssd > 50) return '#00E676';
  if (rmssd > 30) return '#FFD600';
  return '#FF5252';
}

function rmssdLabel(rmssd: number | null): string {
  if (rmssd == null) return 'No Data';
  if (rmssd > 50) return 'Excellent';
  if (rmssd > 30) return 'Good';
  return 'Low';
}

const StatCard: React.FC<{
  icon: string;
  label: string;
  value: string;
  sub?: string;
  color?: string;
}> = ({icon, label, value, sub, color = '#c0b0ff'}) => (
  <View style={cardStyles.card}>
    <Icon name={icon} size={30} color={color} />
    <Text style={cardStyles.value}>{value}</Text>
    <Text style={cardStyles.label}>{label}</Text>
    {sub ? <Text style={[cardStyles.sub, {color}]}>{sub}</Text> : null}
  </View>
);

const cardStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: 'rgba(80, 55, 160, 0.65)',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'rgba(180, 150, 255, 0.25)',
  },
  value: {
    fontSize: 28,
    fontWeight: '800',
    color: '#ffffff',
    marginTop: 6,
  },
  label: {
    fontSize: 12,
    color: 'rgba(200, 180, 255, 0.7)',
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 2,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  sub: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
});

const WeeklyInsightsScreen: React.FC<Props> = ({onBack}) => {
  const [stats, setStats] = useState<WeekStats | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const sessions = await loadSessions();
    const groups = groupByWeek(sessions);
    setStats(computeStats(groups));
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const hrv = stats?.avgRmssd ?? null;
  const hr = stats?.avgHR ?? null;

  return (
    <ImageBackground
      source={require('../assets/images/background2.jpg')}
      style={styles.bg}
      resizeMode="cover">
      <View style={styles.overlay} />
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
          <Icon name="arrow-left" size={28} color="#ffffff" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Weekly Feedback</Text>
          {stats && !loading && (
            <Text style={styles.headerSub}>{stats.weekLabel}</Text>
          )}
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>

        {loading ? (
          <ActivityIndicator color="#c0b0ff" size="large" style={styles.loader} />
        ) : stats == null ? (
          <View style={styles.emptyContainer}>
            <Icon name="chart-line-variant" size={64} color="rgba(180,160,255,0.4)" />
            <Text style={styles.emptyText}>No sessions yet</Text>
            <Text style={styles.emptySubText}>
              Complete recordings to see your weekly insights
            </Text>
          </View>
        ) : (
          <>
            {/* Top stat cards */}
            <View style={styles.cardRow}>
              <StatCard
                icon="calendar-check"
                label="Sessions"
                value={stats.sessionCount.toString()}
              />
              <View style={styles.cardGap} />
              <StatCard
                icon="timer-outline"
                label="Total Time"
                value={formatDuration(stats.totalSeconds)}
              />
            </View>

            {/* HRV Card */}
            <View style={styles.bigCard}>
              <View style={styles.bigCardHeader}>
                <Icon name="heart-pulse" size={26} color={rmssdColor(hrv)} />
                <Text style={styles.bigCardTitle}>Heart Rate Variability</Text>
              </View>
              {hrv != null ? (
                <>
                  <View style={styles.bigValueRow}>
                    <Text style={[styles.bigValue, {color: rmssdColor(hrv)}]}>
                      {hrv.toFixed(1)}
                    </Text>
                    <Text style={styles.bigUnit}>ms  RMSSD</Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      {backgroundColor: `${rmssdColor(hrv)}22`, borderColor: rmssdColor(hrv)},
                    ]}>
                    <Text style={[styles.statusBadgeText, {color: rmssdColor(hrv)}]}>
                      {rmssdLabel(hrv)}
                    </Text>
                  </View>
                  <Text style={styles.bigCardSub}>
                    {hrv > 50
                      ? 'Great recovery. Your nervous system is well balanced this week.'
                      : hrv > 30
                      ? 'Moderate recovery. Consider more rest or lighter activity.'
                      : 'Low HRV detected. Prioritize sleep and stress reduction.'}
                  </Text>
                </>
              ) : (
                <Text style={styles.noDataText}>
                  Complete HRV recordings to see this metric
                </Text>
              )}
            </View>

            {/* HR Card */}
            <View style={styles.bigCard}>
              <View style={styles.bigCardHeader}>
                <Icon name="heart" size={26} color={hrColor(hr)} />
                <Text style={styles.bigCardTitle}>Average Heart Rate</Text>
              </View>
              {hr != null ? (
                <>
                  <View style={styles.bigValueRow}>
                    <Text style={[styles.bigValue, {color: hrColor(hr)}]}>
                      {hr.toFixed(0)}
                    </Text>
                    <Text style={styles.bigUnit}>bpm</Text>
                  </View>
                  <Text style={styles.bigCardSub}>
                    {hr < 60
                      ? 'Resting heart rate is low — excellent cardiovascular fitness.'
                      : hr < 100
                      ? 'Heart rate is in a healthy range for your sessions.'
                      : 'Elevated average HR. Monitor stress levels and hydration.'}
                  </Text>
                </>
              ) : (
                <Text style={styles.noDataText}>
                  Complete Amplitude recordings to see this metric
                </Text>
              )}
            </View>

            {/* Encouragement panel */}
            <View style={styles.encourageCard}>
              <Icon name="star-four-points" size={24} color="#FFD600" />
              <Text style={styles.encourageText}>
                {stats.sessionCount >= 5
                  ? "Amazing consistency! You've built a great streak this week."
                  : stats.sessionCount >= 3
                  ? "Good progress! Aim for 5+ sessions next week."
                  : "Every session counts. Keep showing up!"}
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  bg: {flex: 1, width: '100%', height: '100%'},
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,5,30,0.45)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  backBtn: {marginRight: 14, padding: 4},
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  headerSub: {
    fontSize: 14,
    color: 'rgba(200, 180, 255, 0.7)',
    marginTop: 2,
  },
  scroll: {flex: 1},
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 14,
  },
  loader: {marginTop: 80},
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 80,
    gap: 12,
  },
  emptyText: {
    fontSize: 18,
    color: 'rgba(200, 180, 255, 0.85)',
    fontWeight: '700',
  },
  emptySubText: {
    fontSize: 14,
    color: 'rgba(180, 160, 255, 0.55)',
    textAlign: 'center',
    paddingHorizontal: 30,
  },
  cardRow: {
    flexDirection: 'row',
  },
  cardGap: {width: 12},
  bigCard: {
    backgroundColor: 'rgba(80, 55, 160, 0.65)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(180, 150, 255, 0.25)',
    gap: 10,
  },
  bigCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bigCardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: 'rgba(220, 200, 255, 0.9)',
  },
  bigValueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  bigValue: {
    fontSize: 52,
    fontWeight: '800',
    lineHeight: 58,
  },
  bigUnit: {
    fontSize: 14,
    color: 'rgba(200, 180, 255, 0.65)',
    fontWeight: '600',
    marginBottom: 10,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  bigCardSub: {
    fontSize: 14,
    color: 'rgba(200, 180, 255, 0.7)',
    lineHeight: 20,
    marginTop: 2,
  },
  noDataText: {
    fontSize: 14,
    color: 'rgba(180, 160, 255, 0.5)',
    fontStyle: 'italic',
    paddingTop: 4,
  },
  encourageCard: {
    backgroundColor: 'rgba(100, 70, 200, 0.55)',
    borderRadius: 14,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 214, 0, 0.25)',
  },
  encourageText: {
    flex: 1,
    fontSize: 15,
    color: 'rgba(255, 245, 200, 0.9)',
    fontWeight: '600',
    lineHeight: 22,
  },
});

export default WeeklyInsightsScreen;
