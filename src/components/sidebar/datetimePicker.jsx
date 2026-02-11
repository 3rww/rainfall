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
  selectEarliestlegacyGauge5MinTS,
  selectEarliestlegacyGarr5MinTS,
  selectLatestlegacyGauge5MinTS,
  selectLatestlegacyGaugeTS,
  selectLatestlegacyGarr5MinTS,
  selectLatestlegacyGarrTS
} from '../../store/selectors';
import {
  CONTEXT_TYPES,
  FIVE_MINUTE_ROLLUP,
  RAINFALL_TYPES,
  RAINFALL_MIN_DATE
} from '../../store/config';

import 'react-datepicker/dist/react-datepicker.css';
import './datetimePicker.scss';

class DateTimePicker extends React.Component {
  constructor(props) {
    super(props);

    this.handleEventModalShow = this.handleEventModalShow.bind(this);
    this.handleEventModalClose = this.handleEventModalClose.bind(this);
    this.handleRangeModalShow = this.handleRangeModalShow.bind(this);
    this.handleRangeModalClose = this.handleRangeModalClose.bind(this);
    this.handleApplyRange = this.handleApplyRange.bind(this);

    this.state = {
      showEventModal: false,
      showRangeModal: false,
      pendingStart: null,
      pendingEnd: null
    };
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
    this.setState({
      showRangeModal: true,
      pendingStart: this.props.startDt ? this.props.startDt.toDate() : new Date(),
      pendingEnd: this.props.endDt ? this.props.endDt.toDate() : new Date()
    });
  }

  handleApplyRange() {
    const { pendingStart, pendingEnd } = this.state;

    if (!pendingStart || !pendingEnd) {
      return;
    }

    this.props.dispatchPickRainfallDateTimeRange({
      startDt: moment(pendingStart).toISOString(),
      endDt: moment(pendingEnd).toISOString()
    });

    this.setState({ showRangeModal: false });
  }

  handlePresetPick(range) {
    this.setState({
      pendingStart: range[0].toDate(),
      pendingEnd: range[1].toDate()
    });
  }

  render() {
    const { pendingStart, pendingEnd } = this.state;

    return (
      <div>
        <Modal
          show={this.state.showRangeModal}
          onHide={this.handleRangeModalClose}
          size="lg"
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
                    onClick={() => this.handlePresetPick(range)}
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
                        const nextStart = date;
                        const nextEnd = pendingEnd && date && pendingEnd < date ? date : pendingEnd;
                        this.setState({ pendingStart: nextStart, pendingEnd: nextEnd });
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
                      onChange={(date) => this.setState({ pendingEnd: date })}
                      showTimeSelect
                      timeIntervals={15}
                      dateFormat="MM/dd/yyyy hh:mm aa"
                      minDate={pendingStart || this.props.minDate.toDate()}
                      maxDate={this.props.maxDate.toDate()}
                      className="form-control"
                    />
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
                  value={`${this.props.startDt.format('MM/DD/YYYY hh:mm A')} to ${this.props.endDt.format('MM/DD/YYYY hh:mm A')}`}
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
  let currentKwargs = selectFetchKwargs(state, ownProps.contextType);

  // calculate different available ranges, start, and endtimes, depending on rainfall data type
  let startDt = moment(currentKwargs.startDt);
  let endDt = moment(currentKwargs.endDt);
  let maxDate = false;
  let minDate = RAINFALL_MIN_DATE;
  let ranges = {};
  let isHistoricFiveMinute = (
    ownProps.rainfallDataType === RAINFALL_TYPES.historic
    && currentKwargs.rollup === FIVE_MINUTE_ROLLUP
  );

  if (ownProps.contextType === CONTEXT_TYPES.legacyGarr) {
    if (isHistoricFiveMinute) {
      minDate = selectEarliestlegacyGarr5MinTS(state) || RAINFALL_MIN_DATE;
      maxDate = selectLatestlegacyGarr5MinTS(state) || selectLatestlegacyGarrTS(state);
    } else {
      maxDate = selectLatestlegacyGarrTS(state);
    }
  } else if (ownProps.contextType === CONTEXT_TYPES.legacyGauge) {
    if (isHistoricFiveMinute) {
      minDate = selectEarliestlegacyGauge5MinTS(state) || RAINFALL_MIN_DATE;
      maxDate = selectLatestlegacyGauge5MinTS(state) || selectLatestlegacyGaugeTS(state);
    } else {
      maxDate = selectLatestlegacyGaugeTS(state);
    }
  } else {
    maxDate = moment().toISOString(); // right now
  }

  if (ownProps.rainfallDataType === RAINFALL_TYPES.historic) {
    ranges = {
      'Latest month': [moment(maxDate).startOf('month'), moment(maxDate)],
      'Latest 3 months': [moment(maxDate).subtract(2, 'month').startOf('month'), moment(maxDate)],
      'Latest 6 months': [moment(maxDate).subtract(5, 'month').startOf('month'), moment(maxDate)],
      'Latest 12 months': [moment(maxDate).subtract(11, 'month').startOf('month'), moment(maxDate)],
      'Latest Available This Year': [moment(maxDate).startOf('year'), moment(maxDate)],
      'Last Year': [
        moment(maxDate).subtract(1, 'year').startOf('year'),
        moment(maxDate).subtract(1, 'year').endOf('year')
      ]
    };
  } else if (ownProps.rainfallDataType === RAINFALL_TYPES.realtime) {
    let now = moment().toISOString();
    ranges = {
      'Past 2 hours': [moment(now).subtract(2, 'hour'), moment(now)],
      'Past 4 hours': [moment(now).subtract(4, 'hour'), moment(now)],
      'Past 6 hours': [moment(now).subtract(6, 'hour'), moment(now)],
      'Past 12 hours': [moment(now).subtract(12, 'hour'), moment(now)],
      'Past 24 hours': [moment(now).subtract(24, 'hour'), moment(now)],
      'Past 48 hours': [moment(now).subtract(48, 'hour'), moment(now)],
      Today: [moment(now).startOf('day'), moment(now)],
      Yesterday: [moment(now).subtract(1, 'day').startOf('day'), moment(now).subtract(1, 'day').endOf('day')],
      'Past 3 days': [moment(now).subtract(3, 'day').startOf('day'), moment(now)],
      'Past 7 days': [moment(now).subtract(7, 'day').startOf('day'), moment(now)],
      'Past month': [moment(now).subtract(1, 'month').startOf('day'), moment(now)],
      'Past 3 months': [moment(now).subtract(3, 'month').startOf('month'), moment(now)]
    };
  } else {
    maxDate = false;
    startDt = false;
    endDt = false;
    ranges = {};
  }

  let p = {
    local: { format: 'MM/DD/YYYY hh:mm A' },
    startDt: startDt,
    endDt: endDt,
    minDate: moment(minDate),
    maxDate: moment(maxDate),
    minYear: moment(minDate).year(),
    maxYear: moment().year(),
    ranges: ranges,
    rainfallDataType: ownProps.rainfallDataType,
  };

  return p;
}

const mapDispatchToProps = (dispatch, ownProps) => {
  return {
    dispatchPickRainfallDateTimeRange: payload => {
      dispatch(pickRainfallDateTimeRange({ ...payload, contextType: ownProps.contextType }));
    }
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(DateTimePicker);
