import { fromDateParts, toDateTime } from "../../../store/utils/dateTime";

export const DAY_KEY_FORMAT = "YYYY-MM-DD";

const byStartThenId = (left, right) => {
  const leftStart = toDateTime(left.startDt);
  const rightStart = toDateTime(right.startDt);

  if (leftStart.isBefore(rightStart)) {
    return -1;
  }
  if (leftStart.isAfter(rightStart)) {
    return 1;
  }

  return String(left.eventid).localeCompare(String(right.eventid));
};

export const groupEventsByDay = (events = []) => {
  const eventsByDay = {};

  events.forEach((event) => {
    const start = toDateTime(event?.startDt);
    const end = toDateTime(event?.endDt);

    if (!start.isValid() || !end.isValid() || end.isBefore(start)) {
      return;
    }

    let cursor = start.clone().startOf("day");
    const endDay = end.clone().startOf("day");

    while (cursor.isSameOrBefore(endDay, "day")) {
      const dayKey = cursor.format(DAY_KEY_FORMAT);

      if (!eventsByDay[dayKey]) {
        eventsByDay[dayKey] = [];
      }

      eventsByDay[dayKey].push(event);
      cursor = cursor.add(1, "day");
    }
  });

  Object.keys(eventsByDay).forEach((dayKey) => {
    eventsByDay[dayKey] = eventsByDay[dayKey].slice().sort(byStartThenId);
  });

  return eventsByDay;
};

const buildWeeksForYear = (year, eventsByDay) => {
  const yearStart = toDateTime(`${year}-01-01`).startOf("isoWeek");
  const yearEnd = toDateTime(`${year}-12-31`).endOf("day").endOf("isoWeek");
  const weeks = [];
  let cursor = yearStart.clone();

  while (cursor.isSameOrBefore(yearEnd, "day")) {
    const weekStart = cursor.clone();
    const days = [];

    for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
      const date = weekStart.clone().add(dayOffset, "day");
      const dayKey = date.format(DAY_KEY_FORMAT);
      const dayEvents = eventsByDay[dayKey] || [];

      days.push({
        dayKey,
        inYear: date.year() === year,
        count: dayEvents.length,
        events: dayEvents
      });
    }

    weeks.push({
      weekKey: weekStart.format(DAY_KEY_FORMAT),
      days
    });

    cursor = cursor.add(1, "week");
  }

  return weeks;
};

const buildMonthLabels = (year, weeks) => {
  const monthLabels = [];
  let lastWeekIndex = -1;

  for (let month = 0; month < 12; month += 1) {
    const firstOfMonth = fromDateParts({ year, month, day: 1 });
    const weekIndex = weeks.findIndex((week) => {
      const firstDay = toDateTime(week.days[0].dayKey, { format: DAY_KEY_FORMAT, strict: true });
      const lastDay = toDateTime(week.days[6].dayKey, { format: DAY_KEY_FORMAT, strict: true });
      return firstOfMonth.isSameOrAfter(firstDay, "day") && firstOfMonth.isSameOrBefore(lastDay, "day");
    });

    if (weekIndex >= 0 && weekIndex !== lastWeekIndex) {
      monthLabels.push({
        label: firstOfMonth.format("MMM"),
        weekIndex
      });
      lastWeekIndex = weekIndex;
    }
  }

  return monthLabels;
};

export const buildYearSections = (eventsByDay = {}) => {
  const years = [...new Set(
    Object.keys(eventsByDay)
      .map((dayKey) => Number(dayKey.slice(0, 4)))
      .filter((year) => Number.isFinite(year))
  )]
    .sort((left, right) => right - left);

  return years.map((year) => {
    const weeks = buildWeeksForYear(year, eventsByDay);

    return {
      year,
      weeks,
      monthLabels: buildMonthLabels(year, weeks)
    };
  });
};

export const getCellIntensity = (count = 0) => {
  if (count <= 0) {
    return 0;
  }
  if (count === 1) {
    return 1;
  }
  if (count === 2) {
    return 2;
  }
  if (count === 3) {
    return 3;
  }
  return 4;
};
