import React, { useCallback } from 'react';
import { Row, Col, ListGroup, ProgressBar } from 'react-bootstrap';

import { pickRainfallEvent } from '../../store/features/rainfallThunks';
import { selectFilteredRainfallEvents } from '../../store/selectors';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { toDateTime } from '../../store/utils/dateTime';

import './eventsList.css';

const EventsList = ({ contextType }) => {
  const dispatch = useAppDispatch();
  const events = useAppSelector(selectFilteredRainfallEvents);

  const handleListClick = useCallback((eventid) => {
    dispatch(pickRainfallEvent({ eventid, contextType }));
  }, [contextType, dispatch]);

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
      </Col>
    </Row>
  );
};

export default EventsList;
