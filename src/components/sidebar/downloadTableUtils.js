import moment from "moment";

export const EXCEL_DATETIME_FORMAT = "MM/DD/YYYY HH:mm:ss";
export const CHART_TIMESTAMP_RULE = {
  start: "start",
  midpoint: "midpoint",
  end: "end"
};

const PREFERRED_FIELD_ORDER = ["start_ts", "end_ts", "ts", "val", "src", "id", "type"];

export const formatIsoForExcel = (rawValue) => {
  if (typeof rawValue !== "string") {
    return null;
  }

  const parsed = moment.parseZone(rawValue, moment.ISO_8601, true);
  if (!parsed.isValid()) {
    return null;
  }

  return parsed.format(EXCEL_DATETIME_FORMAT);
};

export const normalizeDownloadRow = (row) => {
  const normalized = { ...row };
  const rawTimestamp = normalized.ts;

  if (typeof rawTimestamp !== "string") {
    return normalized;
  }

  const rangeParts = rawTimestamp.split("/");
  if (rangeParts.length === 2) {
    const startTimestamp = formatIsoForExcel(rangeParts[0].trim());
    const endTimestamp = formatIsoForExcel(rangeParts[1].trim());

    if (startTimestamp !== null && endTimestamp !== null) {
      const { ts, ...withoutTs } = normalized;
      return {
        ...withoutTs,
        start_ts: startTimestamp,
        end_ts: endTimestamp
      };
    }

    return normalized;
  }

  const formattedTimestamp = formatIsoForExcel(rawTimestamp);
  if (formattedTimestamp === null) {
    return normalized;
  }

  return {
    ...normalized,
    ts: formattedTimestamp
  };
};

export const buildDownloadRowsAndFields = (resultsTableData) => {
  const rows = [];
  const sensorTypes = Object.keys(resultsTableData || {});

  sensorTypes.forEach((sensorType) => {
    const sensorRows = resultsTableData[sensorType];
    if (!Array.isArray(sensorRows)) {
      return;
    }

    sensorRows.forEach((sensorRow) => {
      const sensorDataRows = Array.isArray(sensorRow?.data) ? sensorRow.data : [];
      sensorDataRows.forEach((sensorDataRow) => {
        rows.push(
          normalizeDownloadRow({
            ...sensorDataRow,
            id: sensorRow?.id,
            type: sensorType
          })
        );
      });
    });
  });

  const allKeys = new Set();
  const extraFieldOrder = [];

  rows.forEach((row) => {
    Object.keys(row).forEach((key) => {
      allKeys.add(key);
      if (!PREFERRED_FIELD_ORDER.includes(key) && !extraFieldOrder.includes(key)) {
        extraFieldOrder.push(key);
      }
    });
  });

  const orderedPreferredFields = PREFERRED_FIELD_ORDER.filter((key) => allKeys.has(key));

  return {
    rows: rows,
    fields: [...orderedPreferredFields, ...extraFieldOrder]
  };
};

const buildSensorLabel = (sensorType, sensorId) => {
  const readableType = typeof sensorType === "string" && sensorType.length > 0
    ? `${sensorType[0].toUpperCase()}${sensorType.slice(1)}`
    : "Sensor";
  return `${readableType} ${sensorId}`;
};

export const extractChartTimestamp = (rawTimestamp, rule = CHART_TIMESTAMP_RULE.start) => {
  if (typeof rawTimestamp !== "string") {
    return null;
  }

  const rangeParts = rawTimestamp.split("/");
  if (rangeParts.length === 2) {
    const start = moment.parseZone(rangeParts[0].trim(), moment.ISO_8601, true);
    const end = moment.parseZone(rangeParts[1].trim(), moment.ISO_8601, true);

    if (!start.isValid() || !end.isValid()) {
      return null;
    }

    if (rule === CHART_TIMESTAMP_RULE.end) {
      return end.valueOf();
    }

    if (rule === CHART_TIMESTAMP_RULE.midpoint) {
      return Math.round((start.valueOf() + end.valueOf()) / 2);
    }

    return start.valueOf();
  }

  const parsed = moment.parseZone(rawTimestamp, moment.ISO_8601, true);
  if (!parsed.isValid()) {
    return null;
  }

  return parsed.valueOf();
};

export const buildDownloadChartData = (resultsTableData, options = {}) => {
  const timestampRule = options.timestampRule || CHART_TIMESTAMP_RULE.start;
  const rowsByTimestamp = new Map();
  const series = [];
  const seenSeriesKeys = new Set();
  const sensorTypes = Object.keys(resultsTableData || {});

  sensorTypes.forEach((sensorType) => {
    const sensorRows = resultsTableData[sensorType];
    if (!Array.isArray(sensorRows)) {
      return;
    }

    sensorRows.forEach((sensorRow) => {
      const sensorId = sensorRow?.id;
      if (sensorId === null || sensorId === undefined || sensorId === "") {
        return;
      }

      const seriesKey = `${sensorType}:${sensorId}`;
      const sensorDataRows = Array.isArray(sensorRow?.data) ? sensorRow.data : [];

      sensorDataRows.forEach((sensorDataRow) => {
        const timestampMs = extractChartTimestamp(sensorDataRow?.ts, timestampRule);
        const value = Number(sensorDataRow?.val);

        if (timestampMs === null || !Number.isFinite(value)) {
          return;
        }

        if (!seenSeriesKeys.has(seriesKey)) {
          seenSeriesKeys.add(seriesKey);
          series.push({
            key: seriesKey,
            label: buildSensorLabel(sensorType, sensorId),
            sensorType: sensorType,
            sensorId: sensorId
          });
        }

        const existingRow = rowsByTimestamp.get(timestampMs) || { timestampMs: timestampMs };
        existingRow[seriesKey] = value;
        rowsByTimestamp.set(timestampMs, existingRow);
      });
    });
  });

  const rows = [...rowsByTimestamp.values()]
    .sort((left, right) => left.timestampMs - right.timestampMs);

  return {
    rows: rows,
    series: series
  };
};
