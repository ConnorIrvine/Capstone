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

// Fixed Y-axis range matching the Arduino 12-bit ADC (0–4095)
const Y_MIN = 0;
const Y_MAX = 4095;
const Y_RANGE = Y_MAX - Y_MIN;
const GRID_LINES = [0, 1024, 2048, 3072, 4095];

export function PPGChart({ data, width, height = 220 }: PPGChartProps) {
  const screenWidth = width ?? Dimensions.get('window').width - 32;
  const plotW = screenWidth - PAD_LEFT - PAD_RIGHT;
  const plotH = height - PAD_TOP - PAD_BOTTOM;

  const points = useMemo(() => {
    if (data.length < 2) return '';
    return data
      .map((v, i) => {
        const x = PAD_LEFT + (i / (data.length - 1)) * plotW;
        const y = PAD_TOP + plotH - ((v - Y_MIN) / Y_RANGE) * plotH;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }, [data, plotW, plotH]);

  const gridLines = useMemo(() =>
    GRID_LINES.map(val => ({
      val,
      y: PAD_TOP + plotH - ((val - Y_MIN) / Y_RANGE) * plotH,
    })),
    [plotH],
  );

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
        {gridLines.map(({ val, y }) => (
          <React.Fragment key={val}>
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
              {val}
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
