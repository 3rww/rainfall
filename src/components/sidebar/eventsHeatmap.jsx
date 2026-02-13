import React, { useMemo, useState } from "react";
import { connect } from "react-redux";
import { Badge, Button } from "react-bootstrap";
import moment from "moment";

import { pickRainfallEvent } from "../../store/features/rainfallThunks";
import { selectRainfallEvents, selectSelectedEvent } from "../../store/selectors";
import {
  buildYearSections,
  getCellIntensity,
  groupEventsByDay
} from "./eventsHeatmapUtils";

import "./eventsHeatmap.css";

const WEEKDAY_LABELS = [
  { index: 0, label: "Mon" },
  { index: 2, label: "Wed" },
  { index: 4, label: "Fri" }
];

const DAY_LABEL_FORMAT = "ddd, MMM D, YYYY";
const EVENT_LABEL_FORMAT = "DD MMM YYYY, h:mm a";

const cellAriaLabel = (cell) => {
  const dateLabel = moment(cell.dayKey, "YYYY-MM-DD").format(DAY_LABEL_FORMAT);
  const countLabel = `${cell.count} rainfall event${cell.count === 1 ? "" : "s"}`;
  return `${dateLabel}, ${countLabel}`;
};

const EventsHeatmap = ({
  events,
  selectedEventId,
  dispatchPickRainfallEvent,
  onEventSelected
}) => {
  const [activeDayKey, setActiveDayKey] = useState(null);

  const eventsByDay = useMemo(() => groupEventsByDay(events), [events]);
  const yearSections = useMemo(() => buildYearSections(eventsByDay), [eventsByDay]);
  const activeDayEvents = activeDayKey ? (eventsByDay[activeDayKey] || []) : [];
  const activeDayYear = activeDayKey ? Number(activeDayKey.slice(0, 4)) : null;

  const pickEvent = (eventid) => {
    dispatchPickRainfallEvent(eventid);
    if (typeof onEventSelected === "function") {
      onEventSelected();
    }
  };

  const handleDayClick = (cell) => {
    if (!cell.inYear || cell.count === 0) {
      return;
    }

    if (activeDayKey === cell.dayKey) {
      setActiveDayKey(null);
      return;
    }

    setActiveDayKey(cell.dayKey);
  };

  if (!yearSections.length) {
    return (
      <p className="small mb-0">
        <em>No rainfall events are available.</em>
      </p>
    );
  }

  return (
    <div className="events-heatmap">
      {/* <div className="events-heatmap-legend" aria-label="Event density legend">
        <span className="events-heatmap-legend-text">Less</span>
        {[0, 1, 2, 3, 4].map((level) => (
          <span
            className={`events-heatmap-legend-cell intensity-${level}`}
            key={`legend-${level}`}
          />
        ))}
        <span className="events-heatmap-legend-text">More</span>
      </div>       */}
      {yearSections.map((section) => (
        <section
          className="events-heatmap-year-section"
          key={section.year}
          style={{ "--event-week-count": section.weeks.length }}
        >
          <h6 className="events-heatmap-year-title mb-2">{section.year}</h6>
          <div className="events-heatmap-scroll">
            <div className="events-heatmap-month-row">
              {section.monthLabels.map((monthLabel) => (
                <span
                  className="events-heatmap-month-label"
                  key={`${section.year}-${monthLabel.label}`}
                  style={{ gridColumnStart: monthLabel.weekIndex + 1 }}
                >
                  {monthLabel.label}
                </span>
              ))}
            </div>
            <div className="events-heatmap-grid">
              <div className="events-heatmap-weekday-col">
                {WEEKDAY_LABELS.map((weekday) => (
                  <span
                    className="events-heatmap-weekday-label"
                    key={`${section.year}-${weekday.label}`}
                    style={{ gridRowStart: weekday.index + 1 }}
                  >
                    {weekday.label}
                  </span>
                ))}
              </div>
              <div className="events-heatmap-week-cols">
                {section.weeks.map((week) => (
                  <div className="events-heatmap-week-col" key={week.weekKey}>
                    {week.days.map((cell) => {
                      const intensity = getCellIntensity(cell.count);
                      const isSelectedEventDay = cell.events.some((event) => event.eventid === selectedEventId);
                      const classes = [
                        "events-heatmap-day",
                        `intensity-${intensity}`,
                        cell.inYear ? "" : "is-outside-year",
                        activeDayKey === cell.dayKey ? "is-active-day" : "",
                        isSelectedEventDay ? "is-selected-event" : ""
                      ]
                        .filter(Boolean)
                        .join(" ");

                      return (
                        <button
                          aria-label={cellAriaLabel(cell)}
                          className={classes}
                          disabled={!cell.inYear || cell.count === 0}
                          key={cell.dayKey}
                          onClick={() => handleDayClick(cell)}
                          title={cellAriaLabel(cell)}
                          type="button"
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {activeDayYear === section.year && activeDayEvents.length > 0 ? (
            <div className="events-heatmap-day-picker">
              <p className="events-heatmap-day-picker-title">
                {moment(activeDayKey, "YYYY-MM-DD").format(DAY_LABEL_FORMAT)}
                {" "}
                has
                {" "}
                {activeDayEvents.length}
                {" "}
                event
                {activeDayEvents.length === 1 ? ":" : "s. Select one:"}
              </p>
              <div className="events-heatmap-event-list">
                {activeDayEvents.map((event, index) => (
                  <Button
                    className="events-heatmap-event-btn"
                    key={`${event.eventid}-${event.startDt}-${event.endDt}-${index}`}
                    onClick={() => pickEvent(event.eventid)}
                    size="sm"
                    variant="outline-primary"
                  >
                    <span className="events-heatmap-event-label">
                      {moment(event.startDt).format(EVENT_LABEL_FORMAT)}
                      {" to "}
                      {moment(event.endDt).format(EVENT_LABEL_FORMAT)}
                    </span>
                    <Badge bg="secondary">{event.hours}h</Badge>
                  </Button>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ))}

    </div>
  );
};

const mapStateToProps = (state) => {
  const rainfallEvents = selectRainfallEvents(state);
  const maxHours = Number(rainfallEvents?.filters?.maxHours ?? 24);
  const selectedEvent = selectSelectedEvent(state);
  const events = (rainfallEvents?.list || []).filter((event) => (
    maxHours >= 24 ? true : event.hours <= maxHours
  ));

  return {
    events,
    selectedEventId: selectedEvent?.eventid || null
  };
};

const mapDispatchToProps = (dispatch, ownProps) => ({
  dispatchPickRainfallEvent: (eventid) => {
    dispatch(pickRainfallEvent({ eventid, contextType: ownProps.contextType }));
  }
});

export default connect(mapStateToProps, mapDispatchToProps)(EventsHeatmap);
