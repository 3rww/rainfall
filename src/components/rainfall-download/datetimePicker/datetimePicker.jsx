import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Button,
  ButtonGroup,
  InputGroup,
  FormControl,
  Row,
  Col,
  Spinner
} from 'react-bootstrap';
import DatePicker from 'react-datepicker';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendarAlt, faList } from '@fortawesome/free-solid-svg-icons';

import EventsHeatmap from '../eventsHeatmap';
import EventsList from '../eventsList';
import { pickRainfallDateTimeRange } from '../../../store/features/fetchKwargsSlice';
import {
  selectFetchKwargs,
  selectLatestTimestamps
} from '../../../store/selectors';
import {
  CONTEXT_TYPES,
  RAINFALL_TYPES,
  RAINFALL_MIN_DATE
} from '../../../store/config';
import {
  clampDateTimeRange,
  isRangeWithinBounds,
  resolveAvailableBounds
} from '../../../store/utils/dateBounds';
import {
  nowDateTime,
  toDateTime
} from '../../../store/utils/dateTime';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';

import 'react-datepicker/dist/react-datepicker.css';
import './datetimePicker.css';

const DATE_FORMAT = 'MM/DD/YYYY hh:mm A';
const NOTE_DATE_FORMAT = 'MM/DD/YYYY';
const EVENT_MODAL_VIEWS = {
  heatmap: 'heatmap',
  list: 'list'
};

const CONTEXT_AVAILABILITY_LABELS = {
  [CONTEXT_TYPES.legacyRealtime]: 'real-time rainfall',
  [CONTEXT_TYPES.legacyGauge]: 'historical rain gauge rainfall',
  [CONTEXT_TYPES.legacyGarr]: 'calibrated radar rainfall'
};

const buildPickerModel = ({ contextType, rainfallDataType, currentKwargs, latest }) => {
  const now = nowDateTime().toISOString();
  const bounds = resolveAvailableBounds({
    contextType,
    rainfallDataType,
    rollup: currentKwargs.rollup,
    latest,
    rainfallMinDate: RAINFALL_MIN_DATE,
    now
  });

  const rawStartDt = toDateTime(currentKwargs.startDt);
  const rawEndDt = toDateTime(currentKwargs.endDt);
  let startDt = rawStartDt.clone();
  let endDt = rawEndDt.clone();
  const minDate = bounds.min.clone();
  const maxDate = bounds.max.clone();
  const hasValidRawRange = rawStartDt.isValid() && rawEndDt.isValid();

  if (hasValidRawRange) {
    const clampedActiveRange = clampDateTimeRange({
      start: rawStartDt,
      end: rawEndDt,
      min: minDate,
      max: maxDate
    });

    startDt = clampedActiveRange.start;
    endDt = clampedActiveRange.end;
  } else {
    startDt = false;
    endDt = false;
  }

  let ranges = {};
  if (rainfallDataType === RAINFALL_TYPES.historic) {
    ranges = {
      'Latest month': [maxDate.clone().startOf('month'), maxDate.clone()],
      'Latest 3 months': [maxDate.clone().subtract(2, 'month').startOf('month'), maxDate.clone()],
      'Latest 6 months': [maxDate.clone().subtract(5, 'month').startOf('month'), maxDate.clone()],
      'Latest 12 months': [maxDate.clone().subtract(11, 'month').startOf('month'), maxDate.clone()],
      'Latest Available This Year': [maxDate.clone().startOf('year'), maxDate.clone()],
      'Last Year': [
        maxDate.clone().subtract(1, 'year').startOf('year'),
        maxDate.clone().subtract(1, 'year').endOf('year')
      ]
    };
  } else if (rainfallDataType === RAINFALL_TYPES.realtime) {
    ranges = {
      'Past 2 hours': [maxDate.clone().subtract(2, 'hour'), maxDate.clone()],
      'Past 4 hours': [maxDate.clone().subtract(4, 'hour'), maxDate.clone()],
      'Past 6 hours': [maxDate.clone().subtract(6, 'hour'), maxDate.clone()],
      'Past 12 hours': [maxDate.clone().subtract(12, 'hour'), maxDate.clone()],
      'Past 24 hours': [maxDate.clone().subtract(24, 'hour'), maxDate.clone()],
      'Past 48 hours': [maxDate.clone().subtract(48, 'hour'), maxDate.clone()],
      Today: [maxDate.clone().startOf('day'), maxDate.clone()],
      Yesterday: [maxDate.clone().subtract(1, 'day').startOf('day'), maxDate.clone().subtract(1, 'day').endOf('day')],
      'Past 3 days': [maxDate.clone().subtract(3, 'day').startOf('day'), maxDate.clone()],
      'Past 7 days': [maxDate.clone().subtract(7, 'day').startOf('day'), maxDate.clone()],
      'Past month': [maxDate.clone().subtract(1, 'month').startOf('day'), maxDate.clone()],
      'Past 3 months': [maxDate.clone().subtract(3, 'month').startOf('month'), maxDate.clone()]
    };
  }

  return {
    local: { format: DATE_FORMAT },
    startDt,
    endDt,
    rawStartDt,
    rawEndDt,
    minDate,
    maxDate,
    minYear: minDate.year(),
    maxYear: maxDate.year(),
    ranges,
    rollup: currentKwargs.rollup
  };
};

const DateTimePicker = ({ rainfallDataType, contextType }) => {
  const dispatch = useAppDispatch();
  const [showEventModal, setShowEventModal] = useState(false);
  const [eventModalView, setEventModalView] = useState(EVENT_MODAL_VIEWS.heatmap);
  const [showRangeModal, setShowRangeModal] = useState(false);
  const [pendingStart, setPendingStart] = useState(null);
  const [pendingEnd, setPendingEnd] = useState(null);

  const currentKwargs = useAppSelector((state) => selectFetchKwargs(state, contextType));
  const latestTimestamps = useAppSelector(selectLatestTimestamps);

  const pickerModel = useMemo(() => buildPickerModel({
    contextType,
    rainfallDataType,
    currentKwargs,
    latest: latestTimestamps
  }), [contextType, rainfallDataType, currentKwargs, latestTimestamps]);

  const dispatchPickRainfallDateTimeRange = useCallback((payload) => {
    dispatch(pickRainfallDateTimeRange({ ...payload, contextType }));
  }, [contextType, dispatch]);

  useEffect(() => {
    if (!pickerModel.rawStartDt.isValid() || !pickerModel.rawEndDt.isValid()) {
      return;
    }

    const clamped = clampDateTimeRange({
      start: pickerModel.rawStartDt,
      end: pickerModel.rawEndDt,
      min: pickerModel.minDate,
      max: pickerModel.maxDate
    });

    if (!clamped.start || !clamped.end) {
      return;
    }

    if (!clamped.start.isSame(pickerModel.rawStartDt) || !clamped.end.isSame(pickerModel.rawEndDt)) {
      dispatchPickRainfallDateTimeRange({
        startDt: clamped.start.toISOString(),
        endDt: clamped.end.toISOString()
      });
    }
  }, [dispatchPickRainfallDateTimeRange, pickerModel.maxDate, pickerModel.minDate, pickerModel.rawEndDt, pickerModel.rawStartDt]);

  useEffect(() => {
    if (!showRangeModal) {
      return;
    }

    const clamped = clampDateTimeRange({
      start: pendingStart || pickerModel.startDt,
      end: pendingEnd || pickerModel.endDt,
      min: pickerModel.minDate,
      max: pickerModel.maxDate
    });

    if (!clamped.start || !clamped.end) {
      return;
    }

    const nextPendingStart = clamped.start.toDate();
    const nextPendingEnd = clamped.end.toDate();

    const startChanged = pendingStart === null || pendingStart.getTime() !== nextPendingStart.getTime();
    const endChanged = pendingEnd === null || pendingEnd.getTime() !== nextPendingEnd.getTime();

    if (startChanged) {
      setPendingStart(nextPendingStart);
    }

    if (endChanged) {
      setPendingEnd(nextPendingEnd);
    }
  }, [pendingEnd, pendingStart, pickerModel.endDt, pickerModel.maxDate, pickerModel.minDate, pickerModel.startDt, showRangeModal]);

  const handleRangeModalShow = useCallback(() => {
    const clamped = clampDateTimeRange({
      start: pickerModel.startDt,
      end: pickerModel.endDt,
      min: pickerModel.minDate,
      max: pickerModel.maxDate
    });

    setShowRangeModal(true);
    setPendingStart(clamped.start ? clamped.start.toDate() : pickerModel.minDate.toDate());
    setPendingEnd(clamped.end ? clamped.end.toDate() : pickerModel.maxDate.toDate());
  }, [pickerModel.endDt, pickerModel.maxDate, pickerModel.minDate, pickerModel.startDt]);

  const handleApplyRange = useCallback(() => {
    if (!pendingStart || !pendingEnd) {
      return;
    }

    const clamped = clampDateTimeRange({
      start: pendingStart,
      end: pendingEnd,
      min: pickerModel.minDate,
      max: pickerModel.maxDate
    });

    if (!clamped.start || !clamped.end) {
      return;
    }

    dispatchPickRainfallDateTimeRange({
      startDt: clamped.start.toISOString(),
      endDt: clamped.end.toISOString()
    });

    setShowRangeModal(false);
  }, [dispatchPickRainfallDateTimeRange, pendingEnd, pendingStart, pickerModel.maxDate, pickerModel.minDate]);

  const handlePresetPick = useCallback((label, range) => {
    const [attemptedStart, attemptedEnd] = range;
    const isWithinBounds = isRangeWithinBounds({
      start: attemptedStart,
      end: attemptedEnd,
      min: pickerModel.minDate,
      max: pickerModel.maxDate
    });

    if (!isWithinBounds) {
        console.log('[DateTimePicker] preset range outside available bounds', {
          label,
          contextType,
          rollup: pickerModel.rollup,
          attemptedStart: toDateTime(attemptedStart).toISOString(),
          attemptedEnd: toDateTime(attemptedEnd).toISOString(),
          min: pickerModel.minDate.toISOString(),
          max: pickerModel.maxDate.toISOString()
        });
      return;
    }

    setPendingStart(attemptedStart.toDate());
    setPendingEnd(attemptedEnd.toDate());
  }, [contextType, pickerModel.maxDate, pickerModel.minDate, pickerModel.rollup]);

  const availabilityNote = useMemo(() => {
    const contextLabel = CONTEXT_AVAILABILITY_LABELS[contextType] || 'rainfall';
    const intervalLabel = pickerModel.rollup || 'selected';
    const minDateText = pickerModel.minDate.format(NOTE_DATE_FORMAT);
    const maxDateText = pickerModel.maxDate.format(NOTE_DATE_FORMAT);

    return `${intervalLabel} ${contextLabel} data is currently available between ${minDateText} and ${maxDateText}`;
  }, [contextType, pickerModel.maxDate, pickerModel.minDate, pickerModel.rollup]);

  const closeEventModal = useCallback(() => {
    setShowEventModal(false);
    setEventModalView(EVENT_MODAL_VIEWS.heatmap);
  }, []);

  const handleEventModalShow = useCallback(() => {
    setShowEventModal(true);
    setEventModalView(EVENT_MODAL_VIEWS.heatmap);
  }, []);

  return (
    <div>
      <Modal
        show={showRangeModal}
        onHide={() => setShowRangeModal(false)}
        size="lg"
        animation={false}
      >
        <Modal.Header closeButton>
          <Modal.Title>Select Date and Time Range</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Row className="g-3">
            <Col xs={3} className="border-end">
              <div className="btn-group-vertical w-100" role="group" aria-label="Quick Ranges">
                {Object.entries(pickerModel.ranges).map(([label, range]) => (
                  <Button
                    key={`${contextType}-${label}`}
                    variant="outline-primary"
                    size="sm"
                    onClick={() => handlePresetPick(label, range)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </Col>
            <Col xs={9}>
              <Row>
                <Col md={6}>
                  <p className="lead mb-0">Start</p>
                  <DatePicker
                    selected={pendingStart}
                    onChange={(date) => {
                      const clamped = clampDateTimeRange({
                        start: date,
                        end: pendingEnd,
                        min: pickerModel.minDate,
                        max: pickerModel.maxDate
                      });
                      setPendingStart(clamped.start ? clamped.start.toDate() : null);
                      setPendingEnd(clamped.end ? clamped.end.toDate() : null);
                    }}
                    showTimeSelect
                    timeIntervals={15}
                    dateFormat="MM/dd/yyyy hh:mm aa"
                    minDate={pickerModel.minDate.toDate()}
                    maxDate={pickerModel.maxDate.toDate()}
                    className="form-control"
                  />
                </Col>
                <Col md={6}>
                  <p className="lead mb-0">End</p>
                  <DatePicker
                    selected={pendingEnd}
                    onChange={(date) => {
                      const clamped = clampDateTimeRange({
                        start: pendingStart,
                        end: date,
                        min: pickerModel.minDate,
                        max: pickerModel.maxDate
                      });
                      setPendingStart(clamped.start ? clamped.start.toDate() : null);
                      setPendingEnd(clamped.end ? clamped.end.toDate() : null);
                    }}
                    showTimeSelect
                    timeIntervals={15}
                    dateFormat="MM/dd/yyyy hh:mm aa"
                    minDate={pendingStart || pickerModel.minDate.toDate()}
                    maxDate={pickerModel.maxDate.toDate()}
                    className="form-control"
                  />
                </Col>
              </Row>
              <Row>
                <Col>
                  <p className="datetimepicker-range-note mb-0">
                    {availabilityNote}
                  </p>
                </Col>
              </Row>
            </Col>
          </Row>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowRangeModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleApplyRange}>
            Apply
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal
        show={showEventModal}
        onHide={closeEventModal}
        size="xl"
        fullscreen={'lg-down'}
        contentClassName="datetimepicker-event-modal-content"
        animation={false}
      >
        <Modal.Header closeButton>
          <Modal.Title>
            Select A Rainfall Event
            <br></br>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="datetimepicker-event-modal-header">
            <ButtonGroup aria-label="Event modal view selector" className="datetimepicker-event-modal-toggle">
              <Button
                id="dtp-eventview-heatmap"
                onClick={() => setEventModalView(EVENT_MODAL_VIEWS.heatmap)}
                variant={eventModalView === EVENT_MODAL_VIEWS.heatmap ? 'primary' : 'outline-primary'}
              >
                Heatmap
              </Button>
              <Button
                id="dtp-eventview-list"
                onClick={() => setEventModalView(EVENT_MODAL_VIEWS.list)}
                variant={eventModalView === EVENT_MODAL_VIEWS.list ? 'primary' : 'outline-primary'}
              >
                Events List
              </Button>
            </ButtonGroup>
            <p className="small text-muted mb-0">
              {eventModalView === EVENT_MODAL_VIEWS.heatmap
                ? 'Select a day from the calendar below to see rainfall event(s) on that day, and select those to use as date/time range for your rainfall data download.'
                : 'Select an event from the list below to use as date/time range for your rainfall data download.'}
            </p>
          </div>

          <div hidden={eventModalView !== EVENT_MODAL_VIEWS.heatmap}>
            <EventsHeatmap
              contextType={contextType}
              onEventSelected={closeEventModal}
            />
          </div>
          <div hidden={eventModalView !== EVENT_MODAL_VIEWS.list}>
            <EventsList
              contextType={contextType}
              onEventSelected={closeEventModal}
            />
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={closeEventModal}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      <Row className="g-0">
        <Col><strong>When</strong></Col>
      </Row>
      <Row className="g-0">
        <Col>
          {pickerModel.startDt !== false && pickerModel.endDt !== false ? (
            <InputGroup className="datetimepicker-control">
              <FormControl
                size="sm"
                readOnly
                placeholder="start and end date/times"
                value={`${pickerModel.startDt.format(DATE_FORMAT)} to ${pickerModel.endDt.format(DATE_FORMAT)}`}
                aria-label="start and end dates"
                className="datetimepicker-control"
              />
              <Button
                variant="light"
                className="datetimepicker-control"
                onClick={handleRangeModalShow}
                id={`dtp-show-datepicker-${rainfallDataType}`}
              >
                <FontAwesomeIcon icon={faCalendarAlt} />
              </Button>

              {rainfallDataType === RAINFALL_TYPES.historic ? (
                <Button
                  id="dtp-show-eventlistmodal"
                  variant="light"
                  onClick={handleEventModalShow}
                  className="datetimepicker-control"
                >
                  <FontAwesomeIcon icon={faList} />
                </Button>
              ) : null}
            </InputGroup>
          ) : (
            <Spinner
              animation="border"
              variant="primary"
              size="sm"
            >
              <span className="visually-hidden">Fetching historic ranges...</span>
            </Spinner>
          )}
        </Col>
      </Row>
    </div>
  );
};

export default DateTimePicker;
