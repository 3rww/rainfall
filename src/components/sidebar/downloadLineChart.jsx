import React, { useEffect, useRef } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { toDateTime } from '../../store/utils/dateTime';

const ZONE = 'America/New_York';
const COLORS = ['#0077b6', '#ff7f11', '#009e73', '#d62828', '#6f4e7c', '#6c757d', '#118ab2', '#8f2d56'];
const formatTime = (seconds, format) => toDateTime(seconds * 1000).tz(ZONE).format(format);

const DownloadLineChart = ({ rows, series, range, onRangeChange }) => {
  const viewport = useRef(null);
  const hasData = rows?.length > 0 && series?.length > 0;
  useEffect(() => {
    if (!hasData || !viewport.current) return;
    const element = viewport.current;
    const chart = new uPlot({
      width: element.clientWidth || 320,
      height: window.innerWidth < 768 ? 320 : 420,
      tzDate: seconds => uPlot.tzDate(new Date(seconds * 1000), ZONE),
      scales: {
        x: { time: true, ...(Number.isFinite(range?.startMs) && Number.isFinite(range?.endMs) ? { range: () => [range.startMs / 1000, range.endMs / 1000] } : {}) },
        y: { range: (_plot, min, max) => [Math.min(0, min ?? 0), max > 0 ? max * 1.08 : 1] }
      },
      axes: [
        { space: 110, values: (_plot, ticks) => ticks.map(tick => formatTime(tick, 'MM/DD HH:mm')) },
        { label: 'Rainfall (inches)', size: 64 }
      ],
      cursor: { drag: { x: true, y: false, setScale: false }, points: { show: false } },
      legend: { show: true, live: true },
      series: [
        { label: 'Eastern time', value: (_plot, value) => value == null ? '' : formatTime(value, 'MM/DD/YYYY h:mm a Z') },
        ...series.map((item, i) => ({
          label: item.label,
          stroke: COLORS[i] || `hsl(${(i * 137.508) % 360} 65% 40%)`,
          width: 1.5,
          spanGaps: false,
          points: { show: false },
          value: (_plot, value, _seriesIndex, dataIndex) => {
            const coverage = rows[dataIndex]?.coverage?.[item.key];
            const reading = value == null ? 'No data' : `${value} in`;
            return coverage ? `${reading} (${coverage.contributing}/${coverage.expected} readings; ${coverage.timestamps} timestamps)` : reading;
          }
        }))
      ],
      hooks: {
        setSelect: [plot => {
          if (plot.select.width < 10) return;
          const startMs = Math.round(plot.posToVal(plot.select.left, 'x') * 1000);
          const endMs = Math.round(plot.posToVal(plot.select.left + plot.select.width, 'x') * 1000);
          if (Number.isFinite(startMs) && endMs > startMs) onRangeChange({ startMs, endMs });
        }]
      }
    }, [rows.map(row => row.timestampMs / 1000), ...series.map(item => rows.map(row => row[item.key] ?? null))], element);
    const reset = () => onRangeChange({});
    element.addEventListener('dblclick', reset);
    let frame;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const width = element.clientWidth || 320;
        const height = window.innerWidth < 768 ? 320 : 420;
        // uPlot 1.6 redraws even for identical sizes; legend changes also notify us.
        if (chart.width !== width || chart.height !== height) chart.setSize({ width, height });
      });
    });
    observer.observe(element);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      element.removeEventListener('dblclick', reset);
      chart.destroy();
    };
  }, [hasData, rows, series, range, onRangeChange]);

  if (!hasData) return <p className="small mb-0"><em>No chartable results were returned for this selection.</em></p>;
  return <div className="download-chart-wrapper" role="img" aria-label="Rainfall results line chart" ref={viewport} />;
};
export default React.memo(DownloadLineChart);
