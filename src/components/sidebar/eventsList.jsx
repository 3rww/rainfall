import React, { useCallback } from 'react';
import { Row, Col, ListGroup, ProgressBar } from 'react-bootstrap';

import { pickRainfallEvent } from '../../store/features/rainfallThunks';
import { selectFilteredRainfallEvents } from '../../store/selectors';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { toDateTime } from '../../store/utils/dateTime';

import './eventsList.css';

const EventsList = ({ contextType, onEventSelected }) => {
  const dispatch = useAppDispatch();
  const events = useAppSelector(selectFilteredRainfallEvents);
  const rainfallEventsState = useAppSelector((state) => state.rainfallEvents);
  const loadStatus = rainfallEventsState?.loadStatus;
  const error = rainfallEventsState?.error;

  const handleListClick = useCallback((eventid) => {
    dispatch(pickRainfallEvent({ eventid, contextType }));
    if (typeof onEventSelected === 'function') {
      onEventSelected();
    }
  }, [contextType, dispatch, onEventSelected]);

  if (!events.length) {
    if (loadStatus === 'loading') {
      return (
        <p className="small mb-0 text-muted">
          <em>Loading rainfall events...</em>
        </p>
      );
    }

    if (loadStatus === 'failed') {
      return (
        <p className="small mb-0 text-danger">
          <em>{error || 'Unable to load rainfall events.'}</em>
        </p>
      );
    }

    return (
      <p className="small mb-0">
        <em>No rainfall events are available.</em>
      </p>
    );
  }

  return (
    <Row>
      <Col>
        <ListGroup variant="flush">
          {events.map((event, index) => {
            const startDt = toDateTime(event.startDt);
            const endDt = toDateTime(event.endDt);
            const pct = (event.hours / 48) * 100;

            return (
              <ListGroup.Item
                action
                onClick={() => handleListClick(event.eventid)}
                key={index}
                eventKey={event.eventid}
                className="event-list-item"
              >
                <small>
                  <Row>
                    <Col xs={7}>
                      {startDt.format('DD MMM YYYY, h:mm a')} &mdash; {endDt.format('DD MMM YYYY, h:mm a')}&nbsp;
                    </Col>
                    <Col xs={5}>
                      {event.hours} hour{event.hours > 1 ? 's' : ''}
                    </Col>
                  </Row>
                </small>
                <Row>
                  <Col>
                    <ProgressBar
                      className="event-length-bar"
                      now={pct}
                      variant="primary"
                    />
                  </Col>
                </Row>
              </ListGroup.Item>
            );
          })}
        </ListGroup>
        {loadStatus === 'loading' ? (
          <p className="small text-muted mt-2 mb-0">
            <em>Loading more rainfall events...</em>
          </p>
        ) : null}
        {loadStatus === 'failed' ? (
          <p className="small text-warning mt-2 mb-0">
            <em>Some rainfall events may be missing: {error || 'loading stopped before all pages were fetched.'}</em>
          </p>
        ) : null}
      </Col>
    </Row>
  );
};

export default React.memo(EventsList);
