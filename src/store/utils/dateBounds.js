import {
  CONTEXT_TYPES,
  FIVE_MINUTE_ROLLUP
} from "../config";
import {
  nowDateTime,
  toValidDateTime,
  isDateTime
} from "./dateTime";

const toValidMoment = (value) => {
  if (isDateTime(value)) {
    return value.isValid() ? value.clone() : null;
  }
  return toValidDateTime(value);
};

const latestMoment = (...values) => {
  const candidates = values
    .map((value) => toValidMoment(value))
    .filter((value) => value !== null);

  if (candidates.length === 0) {
    return null;
  }

  return candidates.reduce((latest, candidate) => (
    candidate.isAfter(latest) ? candidate : latest
  ));
};

export const clampDateTime = (value, min, max) => {
  const minMoment = toValidMoment(min);
  const maxMoment = toValidMoment(max);
  const valueMoment = toValidMoment(value);

  if (!minMoment || !maxMoment) {
    return valueMoment;
  }

  if (!valueMoment) {
    return null;
  }

  if (valueMoment.isBefore(minMoment)) {
    return minMoment.clone();
  }

  if (valueMoment.isAfter(maxMoment)) {
    return maxMoment.clone();
  }

  return valueMoment;
};

export const clampDateTimeRange = ({ start, end, min, max }) => {
  const parsedMin = toValidMoment(min);
  const parsedMax = toValidMoment(max);

  if (!parsedMin || !parsedMax) {
    return {
      start: toValidMoment(start),
      end: toValidMoment(end),
      min: parsedMin,
      max: parsedMax
    };
  }

  let nextMin = parsedMin;
  let nextMax = parsedMax;
  if (nextMin.isAfter(nextMax)) {
    nextMin = nextMax.clone();
  }

  let nextStart = toValidMoment(start) || nextMin.clone();
  let nextEnd = toValidMoment(end) || nextMax.clone();

  nextStart = clampDateTime(nextStart, nextMin, nextMax) || nextMin.clone();
  nextEnd = clampDateTime(nextEnd, nextMin, nextMax) || nextMax.clone();

  if (nextEnd.isBefore(nextStart)) {
    nextEnd = nextStart.clone();
  }

  return {
    start: nextStart,
    end: nextEnd,
    min: nextMin,
    max: nextMax
  };
};

export const isRangeWithinBounds = ({ start, end, min, max }) => {
  const parsedStart = toValidMoment(start);
  const parsedEnd = toValidMoment(end);
  const parsedMin = toValidMoment(min);
  const parsedMax = toValidMoment(max);

  if (!parsedStart || !parsedEnd || !parsedMin || !parsedMax) {
    return false;
  }

  if (parsedEnd.isBefore(parsedStart)) {
    return false;
  }

  return (
    !parsedStart.isBefore(parsedMin)
    && !parsedEnd.isAfter(parsedMax)
  );
};

export const resolveAvailableBounds = ({
  contextType,
  rainfallDataType,
  rollup,
  latest,
  rainfallMinDate,
  now
}) => {
  void rainfallDataType;

  const latestValues = latest || {};
  const nowMoment = toValidMoment(now) || nowDateTime();
  const envMin = toValidMoment(rainfallMinDate) || toValidDateTime("2000-04-01");

  const isHistoricContext = contextType === CONTEXT_TYPES.legacyGauge || contextType === CONTEXT_TYPES.legacyGarr;
  if (isHistoricContext) {
    const dataset = contextType === CONTEXT_TYPES.legacyGauge ? "gauge" : "radar";
    const interval = rollup === FIVE_MINUTE_ROLLUP ? "5min" : "15min";
    const earliest = toValidMoment(latestValues[`earliest-${interval}-calibrated-${dataset}`]);
    const max = toValidMoment(latestValues[`latest-${interval}-calibrated-${dataset}`]);
    const min = earliest && latestMoment(earliest, envMin);
    if (!min || !max || min.isAfter(max)) {
      return { min: null, max: null, available: false };
    }
    return { min, max, available: true };
  }

  let min = envMin.clone();
  let max = nowMoment.clone();

  if (contextType === CONTEXT_TYPES.legacyRealtime) {
    max = latestMoment(
      latestValues["realtime-radar"],
      latestValues["realtime-gauge"]
    ) || nowMoment.clone();
    min = max.clone().subtract(1, "year").startOf("month");
  }

  if (min.isAfter(max)) {
    min = max.clone();
  }

  return {
    min,
    max,
    available: true
  };
};
