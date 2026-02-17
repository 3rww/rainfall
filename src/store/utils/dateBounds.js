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

  const gaugeFallbackMax = nowMoment.clone().subtract(60, "days").endOf("month");
  const garrFallbackMax = nowMoment.clone().subtract(60, "days").endOf("month");

  let min = envMin.clone();
  let max = nowMoment.clone();

  if (contextType === CONTEXT_TYPES.legacyRealtime) {
    max = latestMoment(
      latestValues["realtime-radar"],
      latestValues["realtime-gauge"]
    ) || nowMoment.clone();
    min = max.clone().subtract(1, "year").startOf("month");
  } else if (contextType === CONTEXT_TYPES.legacyGauge) {
    const calibratedMax = toValidMoment(latestValues["calibrated-gauge"]);
    const isFiveMinute = rollup === FIVE_MINUTE_ROLLUP;

    if (isFiveMinute) {
      min = toValidMoment(latestValues["earliest-5min-calibrated-gauge"]) || envMin.clone();
      max = (
        toValidMoment(latestValues["latest-5min-calibrated-gauge"])
        || calibratedMax
        || nowMoment.clone()
      );
    } else {
      min = envMin.clone();
      max = calibratedMax || gaugeFallbackMax;
    }
  } else if (contextType === CONTEXT_TYPES.legacyGarr) {
    const calibratedMax = toValidMoment(latestValues["calibrated-radar"]);
    const isFiveMinute = rollup === FIVE_MINUTE_ROLLUP;

    if (isFiveMinute) {
      min = toValidMoment(latestValues["earliest-5min-calibrated-radar"]) || envMin.clone();
      max = (
        toValidMoment(latestValues["latest-5min-calibrated-radar"])
        || calibratedMax
        || nowMoment.clone()
      );
    } else {
      min = envMin.clone();
      max = calibratedMax || garrFallbackMax;
    }
  }

  if (min.isAfter(max)) {
    min = max.clone();
  }

  return {
    min,
    max
  };
};
