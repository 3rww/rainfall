import React from 'react';
import { connect } from 'react-redux';
import {
  Modal,
  Button,
  InputGroup,
  FormControl,
  Row,
  Col,
  Spinner
} from 'react-bootstrap';
import moment from 'moment';
import DatePicker from 'react-datepicker';

// icons
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendarAlt, faList } from '@fortawesome/free-solid-svg-icons';

import EventsList from './eventsList';
import { pickRainfallDateTimeRange } from '../../store/actions';
import {
  selectFetchKwargs,
  selectLatestTimestamps
} from '../../store/selectors';
import {
  CONTEXT_TYPES,
  RAINFALL_TYPES,
  RAINFALL_MIN_DATE
} from '../../store/config';
import {
  clampDateTimeRange,
  isRangeWithinBounds,
  resolveAvailableBounds
} from '../../store/utils/dateBounds';

import 'react-datepicker/dist/react-datepicker.css';
import './datetimePicker.scss';

const DATE_FORMAT = 'MM/DD/YYYY hh:mm A';
const NOTE_DATE_FORMAT = 'MM/DD/YYYY';

const CONTEXT_AVAILABILITY_LABELS = {
  [CONTEXT_TYPES.legacyRealtime]: 'real-time rainfall',
  [CONTEXT_TYPES.legacyGauge]: 'historical rain gauge rainfall',
  [CONTEXT_TYPES.legacyGarr]: 'calibrated radar rainfall'
};

class DateTimePicker extends React.Component {
  constructor(props) {
    super(props);

    this.handleEventModalShow = this.handleEventModalShow.bind(this);
    this.handleEventModalClose = this.handleEventModalClose.bind(this);
    this.handleRangeModalShow = this.handleRangeModalShow.bind(this);
    this.handleRangeModalClose = this.handleRangeModalClose.bind(this);
    this.handleApplyRange = this.handleApplyRange.bind(this);
    this.handlePresetPick = this.handlePresetPick.bind(this);

    this.state = {
      showEventModal: false,
      showRangeModal: false,
      pendingStart: null,
      pendingEnd: null
    };
  }

  componentDidMount() {
    this.clampActiveStoreRange();
  }

  componentDidUpdate(prevProps, prevState) {
    const boundsChanged = (
      !this.props.minDate.isSame(prevProps.minDate)
      || !this.props.maxDate.isSame(prevProps.maxDate)
    );
    const activeChanged = (
      !this.props.rawStartDt.isSame(prevProps.rawStartDt)
      || !this.props.rawEndDt.isSame(prevProps.rawEndDt)
    );

    if (boundsChanged || activeChanged) {
      this.clampActiveStoreRange();
    }

    if (this.state.showRangeModal) {
      const modalJustOpened = !prevState.showRangeModal && this.state.showRangeModal;
      if (modalJustOpened || boundsChanged) {
        this.clampPendingModalRange();
      }
    }
  }

  clampActiveStoreRange() {
    if (!this.props.rawStartDt.isValid() || !this.props.rawEndDt.isValid()) {
      return;
    }

    const clamped = clampDateTimeRange({
      start: this.props.rawStartDt,
      end: this.props.rawEndDt,
      min: this.props.minDate,
      max: this.props.maxDate
    });

    if (!clamped.start || !clamped.end) {
      return;
    }

    if (
      !clamped.start.isSame(this.props.rawStartDt)
      || !clamped.end.isSame(this.props.rawEndDt)
    ) {
      this.props.dispatchPickRainfallDateTimeRange({
        startDt: clamped.start.toISOString(),
        endDt: clamped.end.toISOString()
      });
    }
  }

  clampPendingModalRange() {
    const clamped = clampDateTimeRange({
      start: this.state.pendingStart || this.props.startDt,
      end: this.state.pendingEnd || this.props.endDt,
      min: this.props.minDate,
      max: this.props.maxDate
    });

    if (!clamped.start || !clamped.end) {
      return;
    }

    const nextPendingStart = clamped.start.toDate();
    const nextPendingEnd = clamped.end.toDate();

    const startChanged = (
      this.state.pendingStart === null
      || this.state.pendingStart.getTime() !== nextPendingStart.getTime()
    );
    const endChanged = (
      this.state.pendingEnd === null
      || this.state.pendingEnd.getTime() !== nextPendingEnd.getTime()
    );

    if (startChanged || endChanged) {
      this.setState({
        pendingStart: nextPendingStart,
        pendingEnd: nextPendingEnd
      });
    }
  }

  handleEventModalClose() {
    this.setState({ showEventModal: false });
  }

  handleEventModalShow() {
    this.setState({ showEventModal: true });
  }

  handleRangeModalClose() {
    this.setState({ showRangeModal: false });
  }

  handleRangeModalShow() {
    const clamped = clampDateTimeRange({
      start: this.props.startDt,
      end: this.props.endDt,
      min: this.props.minDate,
      max: this.props.maxDate
    });

    this.setState({
      showRangeModal: true,
      pendingStart: clamped.start ? clamped.start.toDate() : this.props.minDate.toDate(),
      pendingEnd: clamped.end ? clamped.end.toDate() : this.props.maxDate.toDate()
    });
  }

  handleApplyRange() {
    const { pendingStart, pendingEnd } = this.state;

    if (!pendingStart || !pendingEnd) {
      return;
    }

    const clamped = clampDateTimeRange({
      start: pendingStart,
      end: pendingEnd,
      min: this.props.minDate,
      max: this.props.maxDate
    });

    if (!clamped.start || !clamped.end) {
      return;
    }

    this.props.dispatchPickRainfallDateTimeRange({
      startDt: clamped.start.toISOString(),
      endDt: clamped.end.toISOString()
    });

    this.setState({ showRangeModal: false });
  }

  handlePresetPick(label, range) {
    const [attemptedStart, attemptedEnd] = range;
    const isWithinBounds = isRangeWithinBounds({
      start: attemptedStart,
      end: attemptedEnd,
      min: this.props.minDate,
      max: this.props.maxDate
    });

    if (!isWithinBounds) {
      console.log('[DateTimePicker] preset range outside available bounds', {
        label: label,
        contextType: this.props.contextType,
        rollup: this.props.rollup,
        attemptedStart: moment(attemptedStart).toISOString(),
        attemptedEnd: moment(attemptedEnd).toISOString(),
        min: this.props.minDate.toISOString(),
        max: this.props.maxDate.toISOString()
      });
      return;
    }

    this.setState({
      pendingStart: attemptedStart.toDate(),
      pendingEnd: attemptedEnd.toDate()
    });
  }

  buildAvailabilityNote() {
    const contextLabel = (
      CONTEXT_AVAILABILITY_LABELS[this.props.contextType]
      || 'rainfall'
    );
    const intervalLabel = this.props.rollup || 'selected';
    const minDateText = this.props.minDate.format(NOTE_DATE_FORMAT);
    const maxDateText = this.props.maxDate.format(NOTE_DATE_FORMAT);

    return `${intervalLabel} ${contextLabel} data is available between ${minDateText} and ${maxDateText}`;
  }

  render() {
    const { pendingStart, pendingEnd } = this.state;

    return (
      <div>
        <Modal
          show={this.state.showRangeModal}
          onHide={this.handleRangeModalClose}
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
                  {Object.entries(this.props.ranges).map(([label, range]) => (
                    <Button
                      key={`${this.props.contextType}-${label}`}
                      variant="outline-primary"
                      size="sm"
                      onClick={() => this.handlePresetPick(label, range)}
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
                          min: this.props.minDate,
                          max: this.props.maxDate
                        });
                        this.setState({
                          pendingStart: clamped.start ? clamped.start.toDate() : null,
                          pendingEnd: clamped.end ? clamped.end.toDate() : null
                        });
                      }}
                      showTimeSelect
                      timeIntervals={15}
                      dateFormat="MM/dd/yyyy hh:mm aa"
                      minDate={this.props.minDate.toDate()}
                      maxDate={this.props.maxDate.toDate()}
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
                          min: this.props.minDate,
                          max: this.props.maxDate
                        });
                        this.setState({
                          pendingStart: clamped.start ? clamped.start.toDate() : null,
                          pendingEnd: clamped.end ? clamped.end.toDate() : null
                        });
                      }}
                      showTimeSelect
                      timeIntervals={15}
                      dateFormat="MM/dd/yyyy hh:mm aa"
                      minDate={pendingStart || this.props.minDate.toDate()}
                      maxDate={this.props.maxDate.toDate()}
                      className="form-control"
                    />
                  </Col>
                </Row>
                <Row>
                  <Col>
                    <p className="datetimepicker-range-note mb-0">
                      {this.buildAvailabilityNote()}
                    </p>
                  </Col>
                </Row>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={this.handleRangeModalClose}>
              Cancel
            </Button>
            <Button variant="primary" onClick={this.handleApplyRange}>
              Apply
            </Button>
          </Modal.Footer>
        </Modal>

        <Modal
          show={this.state.showEventModal}
          onHide={this.handleEventModalClose}
          size="lg"
          animation={false}
        >
          <Modal.Header closeButton>
            <Modal.Title>
              Select A Rainfall Event
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <EventsList
              contextType={this.props.contextType}
              handleClose={this.handleEventModalClose}
            />
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={this.handleEventModalClose}>
              Close
            </Button>
          </Modal.Footer>
        </Modal>

        <Row className="g-0">
          <Col><strong>When</strong></Col>
        </Row>
        <Row className="g-0">
          <Col>
            {(this.props.startDt !== false && this.props.endDt !== false) ? (
              <InputGroup className="datetimepicker-control">
                <FormControl
                  plaintext
                  readOnly
                  placeholder="start and end date/times"
                  value={`${this.props.startDt.format(DATE_FORMAT)} to ${this.props.endDt.format(DATE_FORMAT)}`}
                  aria-label="start and end dates"
                  className="datetimepicker-control"
                />
                <Button
                  variant="light"
                  className="datetimepicker-control"
                  onClick={this.handleRangeModalShow}
                  id={`dtp-show-datepicker-${this.props.rainfallDataType}`}
                >
                  <FontAwesomeIcon icon={faCalendarAlt} />
                </Button>

                {(this.props.rainfallDataType === RAINFALL_TYPES.historic) ? (
                  <Button
                    id="dtp-show-eventlistmodal"
                    variant="light"
                    onClick={this.handleEventModalShow}
                    className="datetimepicker-control"
                  >
                    <FontAwesomeIcon icon={faList} />
                  </Button>
                ) : (
                  null
                )}
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
  }
}

function mapStateToProps(state, ownProps) {
  const currentKwargs = selectFetchKwargs(state, ownProps.contextType);
  const now = moment().toISOString();
  const bounds = resolveAvailableBounds({
    contextType: ownProps.contextType,
    rainfallDataType: ownProps.rainfallDataType,
    rollup: currentKwargs.rollup,
    latest: selectLatestTimestamps(state),
    rainfallMinDate: RAINFALL_MIN_DATE,
    now: now
  });

  const rawStartDt = moment(currentKwargs.startDt);
  const rawEndDt = moment(currentKwargs.endDt);
  let startDt = rawStartDt.clone();
  let endDt = rawEndDt.clone();
  const minDate = bounds.min.clone();
  const maxDate = bounds.max.clone();
  let ranges = {};
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

  if (ownProps.rainfallDataType === RAINFALL_TYPES.historic) {
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
  } else if (ownProps.rainfallDataType === RAINFALL_TYPES.realtime) {
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
  } else {
    startDt = false;
    endDt = false;
    ranges = {};
  }

  return {
    local: { format: DATE_FORMAT },
    startDt: startDt,
    endDt: endDt,
    rawStartDt: rawStartDt,
    rawEndDt: rawEndDt,
    minDate: minDate,
    maxDate: maxDate,
    minYear: minDate.year(),
    maxYear: maxDate.year(),
    ranges: ranges,
    rainfallDataType: ownProps.rainfallDataType,
    rollup: currentKwargs.rollup
  };
}

const mapDispatchToProps = (dispatch, ownProps) => {
  return {
    dispatchPickRainfallDateTimeRange: payload => {
      dispatch(pickRainfallDateTimeRange({ ...payload, contextType: ownProps.contextType }));
    }
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(DateTimePicker);
