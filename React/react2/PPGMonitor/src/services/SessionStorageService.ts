import AsyncStorage from '@react-native-async-storage/async-storage';

const SESSIONS_KEY = '@calmcoach_sessions';

export type SessionType = 'hrv' | 'amplitude' | 'ppg';

export interface Session {
  id: string;
  type: SessionType;
  startTime: number; // ms timestamp
  endTime: number;   // ms timestamp
  durSeconds: number;
  rmssd?: number;
  meanHR?: number;
  meanAmplitude?: number;
}

export async function saveSession(session: Session): Promise<void> {
  try {
    const existing = await loadSessions();
    const updated = [session, ...existing];
    await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('[SessionStorage] save error:', e);
  }
}

export async function loadSessions(): Promise<Session[]> {
  try {
    const raw = await AsyncStorage.getItem(SESSIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn('[SessionStorage] load error:', e);
    return [];
  }
}

export async function clearSessions(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SESSIONS_KEY);
  } catch (e) {
    console.warn('[SessionStorage] clear error:', e);
  }
}

export async function deleteSession(sessionId: string): Promise<void> {
  try {
    const existing = await loadSessions();
    const updated = existing.filter(s => s.id !== sessionId);
    await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('[SessionStorage] delete error:', e);
  }
}

/** Returns sessions grouped into ISO weeks, sorted newest first.
 *  Each week: { weekStart: Date (monday), sessions: Session[] }
 */
export function groupByWeek(sessions: Session[]): {weekStart: Date; sessions: Session[]}[] {
  const map = new Map<string, Session[]>();
  for (const s of sessions) {
    const d = new Date(s.startTime);
    const day = d.getDay(); // 0=sun
    const diff = (day === 0 ? -6 : 1 - day); // shift to monday
    const monday = new Date(d);
    monday.setDate(d.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    const key = monday.toISOString();
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(s);
  }
  const weeks = Array.from(map.entries()).map(([key, sArr]) => ({
    weekStart: new Date(key),
    sessions: sArr.sort((a, b) => a.startTime - b.startTime),
  }));
  return weeks.sort((a, b) => b.weekStart.getTime() - a.weekStart.getTime());
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.round(seconds / 60);
  return `${m} min`;
}

export function formatTime(ts: number): string {
  const d = new Date(ts);
  let h = d.getHours();
  const min = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  if (min === 0) return `${h}${ampm}`;
  return `${h}:${String(min).padStart(2, '0')}${ampm}`;
}

const DAY_ABBRS = ['Sun', 'Mon', 'Tues', 'Wed', 'Thurs', 'Fri', 'Sat'];
export function formatDayLabel(ts: number): string {
  const d = new Date(ts);
  return `${DAY_ABBRS[d.getDay()]} ${d.getDate()}`;
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
export function formatWeekLabel(weekStart: Date): string {
  const end = new Date(weekStart);
  end.setDate(weekStart.getDate() + 6);
  const sMonth = MONTH_NAMES[weekStart.getMonth()];
  const eMonth = MONTH_NAMES[end.getMonth()];
  if (sMonth === eMonth) {
    return `${sMonth} ${weekStart.getDate()} - ${end.getDate()}`;
  }
  return `${sMonth} ${weekStart.getDate()} - ${eMonth} ${end.getDate()}`;
}
