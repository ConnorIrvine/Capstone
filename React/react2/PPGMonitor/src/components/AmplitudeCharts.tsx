import React, {useCallback, useEffect, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {
  Canvas,
  Path as SkiaPath,
  Skia,
  Line,
  vec,
  Text as SkiaText,
  Circle,
  matchFont,
} from '@shopify/react-native-skia';
import type {AmplitudeEvent, HRDataPoint} from '../services/AmplitudeService';

// ─── Chart data types ─────────────────────────────────────
export interface AmplitudeChartsData {
  /** Accumulated HR time series — {time_s, hr_bpm}[] */
  hrSeries: HRDataPoint[];
  /** All amplitude events received so far */
  events: AmplitudeEvent[];
}

interface Props {
  width: number;
  /** Total height for all three charts combined */
  height: number;
  dataRef: React.MutableRefObject<AmplitudeChartsData>;
}

const GRID_LINES = 4;
const CHART_GAP = 6;

const AmplitudeCharts: React.FC<Props> = ({width, height, dataRef}) => {
  const [tick, setTick] = useState(0);

  // Re-render at ~4 fps (charts update ~1 Hz from API, no need for 30 fps)
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 250);
    return () => clearInterval(interval);
  }, []);

  const pad = {top: 18, bottom: 14, left: 44, right: 12};
  const chartCount = 3;
  const singleH = (height - CHART_GAP * (chartCount - 1)) / chartCount;
  const plotW = width - pad.left - pad.right;
  const plotH = singleH - pad.top - pad.bottom;

  const fontStyle = {fontFamily: 'monospace', fontSize: 9, fontWeight: '400' as const};
  const font = matchFont(fontStyle);
  const titleFont = matchFont({fontFamily: 'monospace', fontSize: 10, fontWeight: '600' as const});

  // ─── Helper: auto-range ──────────────────────────────────
  const autoRange = useCallback(
    (values: number[], minSpan = 5): [number, number] => {
      if (values.length === 0) {
        return [0, minSpan];
      }
      let lo = Math.min(...values);
      let hi = Math.max(...values);
      if (hi - lo < minSpan) {
        const mid = (lo + hi) / 2;
        lo = mid - minSpan / 2;
        hi = mid + minSpan / 2;
      }
      const margin = (hi - lo) * 0.08;
      return [lo - margin, hi + margin];
    },
    [],
  );

  // ─── Helper: time range (shared x-axis) ──────────────────
  const data = dataRef.current;
  const hrSeries = data.hrSeries;
  const events = data.events;

  let tMin = 0;
  let tMax = 30;
  if (hrSeries.length > 0) {
    tMin = hrSeries[0].time_s;
    tMax = hrSeries[hrSeries.length - 1].time_s;
    if (tMax - tMin < 10) {
      tMax = tMin + 10;
    }
  }

  // ─── Helper: map value→pixel ─────────────────────────────
  const xPx = useCallback(
    (t: number) => pad.left + ((t - tMin) / (tMax - tMin)) * plotW,
    [tMin, tMax, plotW, pad.left],
  );

  const yPx = useCallback(
    (v: number, lo: number, hi: number, offsetY: number) =>
      offsetY + pad.top + plotH * (1 - (v - lo) / (hi - lo)),
    [plotH, pad.top],
  );

  // ─── Build elements for each chart ────────────────────────
  const elements: React.ReactNode[] = [];
  let key = 0;
  const k = () => key++;

  // ─── CHART 1: Heart Rate with peak/trough markers ────────
  const hrVals = hrSeries.map(p => p.hr_bpm);
  const [hrLo, hrHi] = autoRange(hrVals, 10);
  const chart1Y = 0;

  // Title
  elements.push(
    <SkiaText key={k()} x={pad.left} y={chart1Y + 12} text="Heart Rate (BPM)" font={titleFont} color="#aaaacc" />,
  );

  // Grid + labels
  for (let i = 0; i <= GRID_LINES; i++) {
    const v = hrLo + (i / GRID_LINES) * (hrHi - hrLo);
    const py = yPx(v, hrLo, hrHi, chart1Y);
    elements.push(
      <Line key={k()} p1={vec(pad.left, py)} p2={vec(width - pad.right, py)} color="rgba(255,255,255,0.08)" strokeWidth={1} />,
    );
    elements.push(
      <SkiaText key={k()} x={2} y={py + 3} text={v.toFixed(0)} font={font} color="rgba(255,255,255,0.35)" />,
    );
  }

  // HR line
  if (hrSeries.length >= 2) {
    const path = Skia.Path.Make();
    path.moveTo(xPx(hrSeries[0].time_s), yPx(hrSeries[0].hr_bpm, hrLo, hrHi, chart1Y));
    for (let i = 1; i < hrSeries.length; i++) {
      path.lineTo(xPx(hrSeries[i].time_s), yPx(hrSeries[i].hr_bpm, hrLo, hrHi, chart1Y));
    }
    elements.push(
      <SkiaPath key={k()} path={path} color="#00E676" style="stroke" strokeWidth={1.5} strokeJoin="round" />,
    );
  }

  // Peak markers (▲ red) and trough markers (▼ blue), plus amplitude annotations
  for (const ev of events) {
    const peakX = xPx(ev.peak_time_s);
    const peakY = yPx(ev.peak_hr, hrLo, hrHi, chart1Y);
    const troughX = xPx(ev.time_s);
    const troughY = yPx(ev.trough_hr, hrLo, hrHi, chart1Y);

    // Red ▲ peak marker
    const triUp = Skia.Path.Make();
    triUp.moveTo(peakX, peakY - 6);
    triUp.lineTo(peakX - 4, peakY + 2);
    triUp.lineTo(peakX + 4, peakY + 2);
    triUp.close();
    elements.push(<SkiaPath key={k()} path={triUp} color="#FF5252" style="fill" />);

    // Blue ▼ trough marker
    const triDown = Skia.Path.Make();
    triDown.moveTo(troughX, troughY + 6);
    triDown.lineTo(troughX - 4, troughY - 2);
    triDown.lineTo(troughX + 4, troughY - 2);
    triDown.close();
    elements.push(<SkiaPath key={k()} path={triDown} color="#448AFF" style="fill" />);

    // Purple amplitude line between peak and trough
    const ampLine = Skia.Path.Make();
    ampLine.moveTo(peakX, peakY);
    ampLine.lineTo(troughX, troughY);
    elements.push(
      <SkiaPath key={k()} path={ampLine} color="rgba(186,104,255,0.6)" style="stroke" strokeWidth={1} />,
    );

    // Amplitude label
    const midX = (peakX + troughX) / 2;
    const midY = (peakY + troughY) / 2;
    elements.push(
      <SkiaText key={k()} x={midX - 8} y={midY - 4} text={ev.amplitude.toFixed(1)} font={font} color="#BA68FF" />,
    );
  }

  // ─── CHART 2: Amplitude ──────────────────────────────────
  const chart2Y = singleH + CHART_GAP;
  const ampVals = events.map(e => e.amplitude);
  const [ampLo, ampHi] = autoRange(ampVals, 5);

  elements.push(
    <SkiaText key={k()} x={pad.left} y={chart2Y + 12} text="RSA Amplitude (BPM)" font={titleFont} color="#aaaacc" />,
  );

  for (let i = 0; i <= GRID_LINES; i++) {
    const v = ampLo + (i / GRID_LINES) * (ampHi - ampLo);
    const py = yPx(v, ampLo, ampHi, chart2Y);
    elements.push(
      <Line key={k()} p1={vec(pad.left, py)} p2={vec(width - pad.right, py)} color="rgba(255,255,255,0.08)" strokeWidth={1} />,
    );
    elements.push(
      <SkiaText key={k()} x={2} y={py + 3} text={v.toFixed(1)} font={font} color="rgba(255,255,255,0.35)" />,
    );
  }

  if (events.length >= 2) {
    const path = Skia.Path.Make();
    path.moveTo(xPx(events[0].time_s), yPx(events[0].amplitude, ampLo, ampHi, chart2Y));
    for (let i = 1; i < events.length; i++) {
      path.lineTo(xPx(events[i].time_s), yPx(events[i].amplitude, ampLo, ampHi, chart2Y));
    }
    elements.push(
      <SkiaPath key={k()} path={path} color="#448AFF" style="stroke" strokeWidth={1.5} strokeJoin="round" />,
    );
  }

  // Dots colored by feedback
  const FB_COLORS: Record<string, string> = {green: '#00E676', yellow: '#FFD600', red: '#FF5252'};
  for (const ev of events) {
    elements.push(
      <Circle
        key={k()}
        cx={xPx(ev.time_s)}
        cy={yPx(ev.amplitude, ampLo, ampHi, chart2Y)}
        r={3}
        color={FB_COLORS[ev.feedback_color] ?? '#448AFF'}
      />,
    );
  }

  // ─── CHART 3: Breathing Rate ─────────────────────────────
  const chart3Y = 2 * (singleH + CHART_GAP);
  const brVals = events.map(e => e.breathing_rate_bpm);
  const [brLo, brHi] = autoRange(brVals, 4);

  elements.push(
    <SkiaText key={k()} x={pad.left} y={chart3Y + 12} text="Breathing Rate (br/min)" font={titleFont} color="#aaaacc" />,
  );

  for (let i = 0; i <= GRID_LINES; i++) {
    const v = brLo + (i / GRID_LINES) * (brHi - brLo);
    const py = yPx(v, brLo, brHi, chart3Y);
    elements.push(
      <Line key={k()} p1={vec(pad.left, py)} p2={vec(width - pad.right, py)} color="rgba(255,255,255,0.08)" strokeWidth={1} />,
    );
    elements.push(
      <SkiaText key={k()} x={2} y={py + 3} text={v.toFixed(1)} font={font} color="rgba(255,255,255,0.35)" />,
    );
  }

  if (events.length >= 2) {
    const path = Skia.Path.Make();
    path.moveTo(xPx(events[0].time_s), yPx(events[0].breathing_rate_bpm, brLo, brHi, chart3Y));
    for (let i = 1; i < events.length; i++) {
      path.lineTo(xPx(events[i].time_s), yPx(events[i].breathing_rate_bpm, brLo, brHi, chart3Y));
    }
    elements.push(
      <SkiaPath key={k()} path={path} color="#FF5252" style="stroke" strokeWidth={1.5} strokeJoin="round" />,
    );
  }

  // X markers on breathing rate
  for (const ev of events) {
    const cx = xPx(ev.time_s);
    const cy = yPx(ev.breathing_rate_bpm, brLo, brHi, chart3Y);
    const s = 3;
    const cross = Skia.Path.Make();
    cross.moveTo(cx - s, cy - s);
    cross.lineTo(cx + s, cy + s);
    cross.moveTo(cx + s, cy - s);
    cross.lineTo(cx - s, cy + s);
    elements.push(
      <SkiaPath key={k()} path={cross} color="#FF5252" style="stroke" strokeWidth={1.5} />,
    );
  }

  // Time axis label
  elements.push(
    <SkiaText
      key={k()}
      x={width / 2 - 20}
      y={height - 1}
      text="Time (s)"
      font={font}
      color="rgba(255,255,255,0.4)"
    />,
  );

  return (
    <View style={styles.container}>
      <Canvas style={{width, height}}>{elements}</Canvas>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    overflow: 'hidden',
  },
});

export default React.memo(AmplitudeCharts);
