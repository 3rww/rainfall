import React, { useEffect, useRef } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';

const HEIGHT = 28;
const COLOR = '#0077b6';

// Non-interactive summary of total-across-sensors rainfall, sized to match the slider above which it sits.
const PlaybackSparkline = ({ values, mode }) => {
  const viewport = useRef(null);
  const hasData = values?.some(value => value != null);
  useEffect(() => {
    if (!hasData || !viewport.current) return;
    const element = viewport.current;
    const chart = new uPlot({
      width: element.clientWidth || 200,
      height: HEIGHT,
      padding: [2, 0, 0, 0],
      cursor: { show: false },
      legend: { show: false },
      axes: [{ show: false }, { show: false }],
      scales: { x: { time: false }, y: { range: (_plot, min, max) => [Math.min(0, min ?? 0), max > 0 ? max * 1.08 : 1] } },
      series: [
        {},
        {
          stroke: COLOR, width: 1.5, points: { show: false }, spanGaps: false,
          ...(mode === 'cumulative' ? { fill: `${COLOR}33` } : {})
        }
      ]
    }, [values.map((_, index) => index), values], element);
    let frame;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const width = element.clientWidth || 200;
        if (chart.width !== width) chart.setSize({ width, height: HEIGHT });
      });
    });
    observer.observe(element);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); chart.destroy(); };
  }, [hasData, values, mode]);
  if (!hasData) return null;
  return <div className="playback-sparkline-wrapper" role="img" aria-label="Total rainfall over time" ref={viewport} />;
};
export default React.memo(PlaybackSparkline);
