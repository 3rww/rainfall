import moment from "moment";

export const EXCEL_DATETIME_FORMAT = "MM/DD/YYYY HH:mm:ss";

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
