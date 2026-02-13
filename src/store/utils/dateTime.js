import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isoWeek from "dayjs/plugin/isoWeek";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

dayjs.extend(customParseFormat);
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);
dayjs.extend(isoWeek);
dayjs.extend(timezone);
dayjs.extend(utc);

export const ISO_8601 = "ISO_8601";

export const isDateTime = (value) => dayjs.isDayjs(value);

const parseOffsetMinutes = (value) => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  if (/[zZ]$/.test(trimmed)) {
    return 0;
  }

  const match = trimmed.match(/([+-])(\d{2}):?(\d{2})$/);
  if (!match) {
    return null;
  }

  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number(match[2]);
  const minutes = Number(match[3]);
  return sign * ((hours * 60) + minutes);
};

const parseWithZonePreserved = (value, options = {}) => {
  const strict = options.strict === true;
  const format = options.format;

  const offsetMinutes = parseOffsetMinutes(value);
  if (offsetMinutes === null) {
    if (format && format !== ISO_8601) {
      return dayjs(value, format, strict);
    }
    return dayjs(value);
  }

  const base = (
    format && format !== ISO_8601
      ? dayjs.utc(value, format, strict)
      : dayjs.utc(value)
  );

  if (!base.isValid()) {
    return base;
  }

  return base.utcOffset(offsetMinutes, false);
};

export const toDateTime = (value, options = {}) => {
  if (isDateTime(value)) {
    return value.clone();
  }

  if (options.parseZone === true) {
    return parseWithZonePreserved(value, options);
  }

  if (options.format && options.format !== ISO_8601) {
    return dayjs(value, options.format, options.strict === true);
  }

  return dayjs(value);
};

export const toValidDateTime = (value, options = {}) => {
  if (value === null || value === undefined || value === false) {
    return null;
  }

  const parsed = toDateTime(value, options);
  return parsed.isValid() ? parsed : null;
};

export const nowDateTime = () => dayjs();

export const fromDateParts = ({ year, month, day }) => dayjs(new Date(year, month, day));

export const formatDateTime = (value, format) => {
  const parsed = toValidDateTime(value);
  if (!parsed) {
    return "";
  }
  return parsed.format(format);
};

export const setDateTimeOffset = (value, minutes, keepLocalTime = false) => {
  const parsed = toValidDateTime(value);
  if (!parsed) {
    return null;
  }
  return parsed.utcOffset(minutes, keepLocalTime);
};

export const toISOString = (value) => {
  const parsed = toValidDateTime(value);
  if (!parsed) {
    return null;
  }
  return parsed.toISOString();
};

export const diffDateTime = (left, right, unit, precise = false) => {
  const leftDt = toValidDateTime(left);
  const rightDt = toValidDateTime(right);
  if (!leftDt || !rightDt) {
    return NaN;
  }
  return leftDt.diff(rightDt, unit, precise);
};

export const parseZonedDateTime = (value, strict = true) => (
  toValidDateTime(value, { parseZone: true, strict })
);
