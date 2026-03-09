import React, {useCallback, useEffect, useRef} from 'react';
import {StyleSheet, View} from 'react-native';
import {
  Canvas,
  Path as SkiaPath,
  Skia,
  useCanvasRef,
  Line,
  vec,
  Text as SkiaText,
  useFont,
  matchFont,
} from '@shopify/react-native-skia';

const POINTS = 600; // Number of samples visible on screen
const Y_MIN = 0;
const Y_MAX = 4095;
const GRID_LINES_Y = 5;

interface PPGChartProps {
  width: number;
  height: number;
  dataRef: React.MutableRefObject<number[]>;
  statsRef: React.MutableRefObject<{
    totalSamples: number;
    rate: number;
    lastRxAge: number;
  }>;
}

const PPGChart: React.FC<PPGChartProps> = ({width, height, dataRef, statsRef}) => {
  const canvasRef = useCanvasRef();
  const frameRef = useRef<number>(0);

  const chartPadding = {top: 30, bottom: 30, left: 15, right: 15};
  const chartWidth = width - chartPadding.left - chartPadding.right;
  const chartHeight = height - chartPadding.top - chartPadding.bottom;

  const fontStyle = {
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: '400' as const,
  };
  const font = matchFont(fontStyle);

  // Map data value to y pixel coordinate
  const valueToY = useCallback(
    (value: number): number => {
      const normalized = (value - Y_MIN) / (Y_MAX - Y_MIN);
      return chartPadding.top + chartHeight * (1 - normalized);
    },
    [chartHeight, chartPadding.top],
  );

  // Redraw at ~30fps using requestAnimationFrame for low latency
  useEffect(() => {
    let running = true;
    const tick = () => {
      if (!running) {
        return;
      }
      frameRef.current++;
      // Force Skia canvas redraw by invalidating ref
      canvasRef.current?.redraw();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return () => {
      running = false;
    };
  }, [canvasRef]);

  // Build path from data on each render
  const buildPath = useCallback(() => {
    const data = dataRef.current;
    const path = Skia.Path.Make();
    if (data.length === 0) {
      return path;
    }

    const len = Math.min(data.length, POINTS);
    const startIdx = data.length - len;
    const xStep = chartWidth / (POINTS - 1);

    path.moveTo(
      chartPadding.left,
      valueToY(data[startIdx]),
    );

    for (let i = 1; i < len; i++) {
      path.lineTo(
        chartPadding.left + i * xStep,
        valueToY(data[startIdx + i]),
      );
    }

    return path;
  }, [chartPadding.left, chartWidth, dataRef, valueToY]);

  // Build grid lines paths
  const gridElements = [];
  for (let i = 0; i <= GRID_LINES_Y; i++) {
    const yVal = Y_MIN + (i / GRID_LINES_Y) * (Y_MAX - Y_MIN);
    const yPx = valueToY(yVal);
    gridElements.push(
      <Line
        key={`grid-${i}`}
        p1={vec(chartPadding.left, yPx)}
        p2={vec(width - chartPadding.right, yPx)}
        color="rgba(255,255,255,0.1)"
        strokeWidth={1}
      />,
    );
    gridElements.push(
      <SkiaText
        key={`label-${i}`}
        x={chartPadding.left + 2}
        y={yPx - 3}
        text={Math.round(yVal).toString()}
        font={font}
        color="rgba(255,255,255,0.4)"
      />,
    );
  }

  return (
    <View style={styles.container}>
      <Canvas ref={canvasRef} style={{width, height}}>
        {/* Grid lines */}
        {gridElements}

        {/* PPG signal line */}
        <SkiaPath
          path={buildPath()}
          color="#00E676"
          style="stroke"
          strokeWidth={1.5}
          strokeJoin="round"
          strokeCap="round"
        />

        {/* Stats overlay */}
        <SkiaText
          x={chartPadding.left + 5}
          y={chartPadding.top + 14}
          text={`Samples: ${statsRef.current.totalSamples}  |  Rate: ${statsRef.current.rate.toFixed(1)} Hz  |  Last: ${statsRef.current.lastRxAge.toFixed(2)}s`}
          font={font}
          color="rgba(255,255,255,0.7)"
        />
      </Canvas>
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

export default React.memo(PPGChart);
