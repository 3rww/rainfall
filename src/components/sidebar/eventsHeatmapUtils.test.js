import { describe, expect, it } from "vitest";

import {
  buildYearSections,
  getCellIntensity,
  groupEventsByDay
} from "./eventsHeatmapUtils";

describe("groupEventsByDay", () => {
  it("maps a single event to one day", () => {
    const events = [{
      eventid: "event-1",
      startDt: "2025-06-10T01:00:00",
      endDt: "2025-06-10T03:00:00",
      hours: 2
    }];

    const result = groupEventsByDay(events);

    expect(Object.keys(result)).toEqual(["2025-06-10"]);
    expect(result["2025-06-10"]).toHaveLength(1);
    expect(result["2025-06-10"][0].eventid).toBe("event-1");
  });

  it("maps cross-midnight events to each day they overlap", () => {
    const events = [{
      eventid: "event-overnight",
      startDt: "2025-06-10T23:30:00",
      endDt: "2025-06-11T00:30:00",
      hours: 1
    }];

    const result = groupEventsByDay(events);

    expect(Object.keys(result)).toEqual(["2025-06-10", "2025-06-11"]);
    expect(result["2025-06-10"][0].eventid).toBe("event-overnight");
    expect(result["2025-06-11"][0].eventid).toBe("event-overnight");
  });

  it("counts multiple same-day events independently", () => {
    const events = [
      {
        eventid: "event-a",
        startDt: "2025-07-01T01:00:00",
        endDt: "2025-07-01T02:00:00",
        hours: 1
      },
      {
        eventid: "event-b",
        startDt: "2025-07-01T03:00:00",
        endDt: "2025-07-01T05:00:00",
        hours: 2
      }
    ];

    const result = groupEventsByDay(events);

    expect(result["2025-07-01"]).toHaveLength(2);
  });
});

describe("buildYearSections", () => {
  it("builds newest-first year sections with week/day cells", () => {
    const events = [
      {
        eventid: "event-2024",
        startDt: "2024-12-31T10:00:00",
        endDt: "2024-12-31T11:00:00",
        hours: 1
      },
      {
        eventid: "event-2025",
        startDt: "2025-01-01T02:00:00",
        endDt: "2025-01-01T03:00:00",
        hours: 1
      }
    ];

    const eventsByDay = groupEventsByDay(events);
    const sections = buildYearSections(eventsByDay);

    expect(sections.map((section) => section.year)).toEqual([2025, 2024]);
    expect(sections[0].weeks.length).toBeGreaterThan(0);
    expect(sections[0].monthLabels.some((month) => month.label === "Jan")).toBe(true);

    const janFirstCell = sections[0].weeks
      .flatMap((week) => week.days)
      .find((day) => day.dayKey === "2025-01-01");

    expect(janFirstCell.count).toBe(1);
    expect(janFirstCell.inYear).toBe(true);
  });
});

describe("getCellIntensity", () => {
  it("maps counts into fixed intensity buckets", () => {
    expect(getCellIntensity(0)).toBe(0);
    expect(getCellIntensity(1)).toBe(1);
    expect(getCellIntensity(2)).toBe(2);
    expect(getCellIntensity(3)).toBe(3);
    expect(getCellIntensity(4)).toBe(4);
    expect(getCellIntensity(9)).toBe(4);
  });
});

