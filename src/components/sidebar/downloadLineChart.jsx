import React from "react";
import moment from "moment";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

const CHART_COLORS = [
  "#0077b6",
  "#ff7f11",
  "#009e73",
  "#d62828",
  "#6f4e7c",
  "#6c757d",
  "#118ab2",
  "#8f2d56"
];

const formatAxisTimestamp = (timestampMs) => moment(timestampMs).format("MM/DD HH:mm");
const formatTooltipTimestamp = (timestampMs) => moment(timestampMs).format("MM/DD/YYYY h:mm a");

const DownloadLineChart = ({ rows, series }) => {
  const hasChartData = Array.isArray(rows) && rows.length > 0 && Array.isArray(series) && series.length > 0;

  if (!hasChartData) {
    return (
      <p className="small mb-0">
        <em>No chartable results were returned for this query.</em>
      </p>
    );
  }

  return (
    <div className="download-chart-wrapper" role="img" aria-label="Rainfall results line chart by sensor">
      <ResponsiveContainer width="100%" height={460}>
        <LineChart data={rows} margin={{ top: 16, right: 24, left: 0, bottom: 16 }}>
          <CartesianGrid strokeDasharray="4 4" />
          <XAxis
            dataKey="timestampMs"
            domain={["dataMin", "dataMax"]}
            minTickGap={36}
            tickFormatter={formatAxisTimestamp}
            type="number"
          />
          <YAxis />
          <Tooltip
            formatter={(value, _name, item) => [value, item?.name]}
            labelFormatter={formatTooltipTimestamp}
          />
          <Legend />
          {series.map((seriesItem, index) => (
            <Line
              connectNulls={false}
              dataKey={seriesItem.key}
              dot={false}
              isAnimationActive={false}
              key={seriesItem.key}
              name={seriesItem.label}
              stroke={CHART_COLORS[index % CHART_COLORS.length]}
              strokeWidth={2}
              type="monotone"
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default DownloadLineChart;
