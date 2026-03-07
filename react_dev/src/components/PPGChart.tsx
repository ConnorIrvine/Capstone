import React, { useMemo } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Svg, { Polyline, Line, Text as SvgText, Rect, Defs, LinearGradient, Stop } from 'react-native-svg';

interface PPGChartProps {
  data: number[];
  width?: number;
  height?: number;
}

const PAD_LEFT = 44;
const PAD_RIGHT = 12;
const PAD_TOP = 12;
const PAD_BOTTOM = 24;

// Rounds a value to the nearest "nice" step for axis labels
function niceStep(range: number, steps = 4): number {
  const raw = range / steps;
  const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
  const normalized = raw / magnitude;
  let nice = normalized <= 1.5 ? 1 : normalized <= 3 ? 2 : normalized <= 7 ? 5 : 10;
  return nice * magnitude;
}

export function PPGChart({ data, width, height = 220 }: PPGChartProps) {
  const screenWidth = width ?? Dimensions.get('window').width - 32;
  const plotW = screenWidth - PAD_LEFT - PAD_RIGHT;
  const plotH = height - PAD_TOP - PAD_BOTTOM;

  const { points, gridLines } = useMemo(() => {
    if (data.length < 2) {
      return { points: '', gridLines: [] };
    }

    const rawMin = Math.min(...data);
    const rawMax = Math.max(...data);
    const range = rawMax - rawMin || 1;

    // Compute nice Y-axis range
    const step = niceStep(range, 4);
    const yMin = Math.floor(rawMin / step) * step;
    const yMax = Math.ceil(rawMax / step) * step;
    const yRange = yMax - yMin || 1;

    // Build SVG polyline points string
    const pts = data
      .map((v, i) => {
        const x = PAD_LEFT + (i / (data.length - 1)) * plotW;
        const y = PAD_TOP + plotH - ((v - yMin) / yRange) * plotH;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');

    // Compute horizontal grid lines at even steps
    const lines: { y: number; label: string }[] = [];
    for (let val = yMin; val <= yMax + step * 0.01; val += step) {
      const y = PAD_TOP + plotH - ((val - yMin) / yRange) * plotH;
      if (y >= PAD_TOP - 1 && y <= PAD_TOP + plotH + 1) {
        lines.push({ y, label: Math.round(val).toString() });
      }
    }

    return { points: pts, gridLines: lines };
  }, [data, plotW, plotH]);

  return (
    <View style={[styles.wrapper, { width: screenWidth, height }]}>
      <Svg width={screenWidth} height={height}>
        <Defs>
          <LinearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#1e293b" />
            <Stop offset="1" stopColor="#0f172a" />
          </LinearGradient>
        </Defs>

        {/* Plot background */}
        <Rect
          x={PAD_LEFT}
          y={PAD_TOP}
          width={plotW}
          height={plotH}
          fill="url(#bgGrad)"
          rx={4}
        />

        {/* Grid lines + Y-axis labels */}
        {gridLines.map(({ y, label }: { y: number; label: string }) => (
          <React.Fragment key={label}>
            <Line
              x1={PAD_LEFT}
              y1={y}
              x2={PAD_LEFT + plotW}
              y2={y}
              stroke="#1e3a4a"
              strokeWidth={1}
            />
            <SvgText
              x={PAD_LEFT - 6}
              y={y + 4}
              fontSize={9}
              fill="#475569"
              textAnchor="end"
            >
              {label}
            </SvgText>
          </React.Fragment>
        ))}

        {/* Left border */}
        <Line
          x1={PAD_LEFT}
          y1={PAD_TOP}
          x2={PAD_LEFT}
          y2={PAD_TOP + plotH}
          stroke="#334155"
          strokeWidth={1}
        />

        {/* Bottom border */}
        <Line
          x1={PAD_LEFT}
          y1={PAD_TOP + plotH}
          x2={PAD_LEFT + plotW}
          y2={PAD_TOP + plotH}
          stroke="#334155"
          strokeWidth={1}
        />

        {/* PPG signal line */}
        {data.length >= 2 && (
          <Polyline
            points={points}
            fill="none"
            stroke="#22d3ee"
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
        )}

        {/* X-axis label */}
        <SvgText
          x={PAD_LEFT + plotW / 2}
          y={height - 4}
          fontSize={9}
          fill="#475569"
          textAnchor="middle"
        >
          ← 5 s window →
        </SvgText>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    overflow: 'hidden',
  },
});
