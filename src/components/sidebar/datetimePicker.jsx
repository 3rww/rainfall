
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
} from 'react-bootstrap'
import moment from 'moment'
import DateRangePicker from 'react-bootstrap-daterangepicker';

// icons
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCalendarAlt, faList } from '@fortawesome/free-solid-svg-icons'

import EventsList from './eventsList';
import PaginatedEventsList from './paginatedEventsList'
import { pickRainfallDateTimeRange } from '../../store/actions';
import {
  selectEventStats, 
  selectFetchKwargs,
  selectLatestlegacyGaugeTS,
  selectLatestlegacyGarrTS
} from '../../store/selectors'
import { RAINFALL_TYPES, RAINFALL_MIN_DATE } from '../../store/config'

import 'bootstrap-daterangepicker/daterangepicker.css';
import './datetimePicker.scss'

class DateTimePicker extends React.Component {
  constructor(props) {
    super();

    this.handleOnApply = this.handleOnApply.bind(this);
    this.handleShow = this.handleShow.bind(this);
    this.handleClose = this.handleClose.bind(this);

    this.state = {
      show: false
    }

  }

  handleOnApply(e, p) {
    this.props.dispatchPickRainfallDateTimeRange({
      startDt: p.startDate.toISOString(),
      endDt: p.endDate.toISOString()
    })
  }

  handleClose(e) {
    this.setState({ show: false });
  }

  handleShow(e) {
    this.setState({ show: true });
  }

  render() {

    return (
      <div>

        <Modal
          show={this.state.show}
          onHide={this.handleClose}
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
              handleClose={this.handleClose}
            />
            {/* <PaginatedEventsList/> */}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={this.handleClose}>
              Close
            </Button>
          </Modal.Footer>
        </Modal>

        <Row noGutters>
          <Col ><strong>When</strong></Col>
        </Row>
        <Row noGutters>
          <Col>

            {(this.props.startDt !== false && this.props.endDt !== false) ? (

              <InputGroup className="datetimepicker-control">
                <FormControl
                  plaintext
                  readOnly
                  placeholder="start and end date/times"
                  value={`${this.props.startDt.format("MM/DD/YYYY hh:mm A")} to ${this.props.endDt.format("MM/DD/YYYY hh:mm A")}`}
                  aria-label="start and end dates"
                  className="datetimepicker-control"
                />
                <InputGroup.Append>
                  {/* Button to show a datetime-range picker */}
                  <DateRangePicker
                    id={`dtp-show-daterangepicker-${this.props.rainfallDataType }`}
                    startDate={this.props.startDt}
                    endDate={this.props.endDt}
                    // minDate={this.props.minDate}
                    maxDate={this.props.maxDate}
                    timePicker={true}
                    timePickerIncrement={15}
                    showDropdowns={false}
                    // minYear={this.props.minYear}
                    // maxYear={this.props.maxYear}
                    ranges={this.props.ranges}
                    alwaysShowCalendars={true}
                    onApply={this.handleOnApply}
                    // linkedCalendars={true}
                  >
                    <Button
                      variant="light"
                      className="datetimepicker-control"
                    >
                      <FontAwesomeIcon icon={faCalendarAlt} />
                    </Button>
                  </DateRangePicker>
                  
                  {(this.props.rainfallDataType === RAINFALL_TYPES.historic) ? (
                  <Button
                    id="dtp-show-eventlistmodal"
                    variant="light"
                    onClick={this.handleShow}
                    className="datetimepicker-control"
                  >
                    <FontAwesomeIcon icon={faList} />
                  </Button>
                  ) : (
                    null
                  )}
                </InputGroup.Append>
              </InputGroup>

            ) : (
                <Spinner
                  animation="border"
                  variant="primary"
                  size="sm"
                >
                  <span className="sr-only">"Fetching historic ranges...</span>
                </Spinner>
              )}

          </Col>
        </Row>
      </div>
    );
  }
}

function mapStateToProps(state, ownProps) {
  let currentKwargs = selectFetchKwargs(state, ownProps.contextType)

  // calculate different available ranges, start, and endtimes, depending on rainfall data type
  let startDt = moment(currentKwargs.startDt)
  let endDt = moment(currentKwargs.endDt)
  let maxDate = false
  let ranges = {}
  

  if (ownProps.contextType === "legacyGarr") {
    maxDate = selectLatestlegacyGarrTS(state)
  } else if (ownProps.contextType === "legacyGauge") {
    maxDate = selectLatestlegacyGaugeTS(state)
  } else {
    maxDate = moment().toISOString() // right now
  }

  if (ownProps.rainfallDataType === RAINFALL_TYPES.historic) {
    ranges = {
      "Latest month": [moment(maxDate).startOf('month'), moment(maxDate)],
      "Latest 3 months": [moment(maxDate).subtract(2, 'month').startOf('month'), moment(maxDate)],
      "Latest 6 months": [moment(maxDate).subtract(5, 'month').startOf('month'), moment(maxDate)],
      "Latest 12 months": [moment(maxDate).subtract(11, 'month').startOf('month'), moment(maxDate)],
      "Latest Available This Year": [moment(maxDate).startOf("year"),  moment(maxDate)],
      "Last Year": [
        moment(maxDate).subtract(1, "year").startOf("year"),
        moment(maxDate).subtract(1, "year").endOf("year")
      ],
    }
  } else if (ownProps.rainfallDataType === RAINFALL_TYPES.realtime) {
    let now = moment().toISOString()
    ranges = {
      "Past 2 hours": [moment(now).subtract(2, 'hour'), moment(now)],
      "Past 4 hours": [moment(now).subtract(4, 'hour'), moment(now)],
      "Past 6 hours": [moment(now).subtract(6, 'hour'), moment(now)],
      "Past 12 hours": [moment(now).subtract(12, 'hour'), moment(now)],
      "Past 24 hours": [moment(now).subtract(24, 'hour'), moment(now)],
      "Past 48 hours": [moment(now).subtract(48, 'hour'), moment(now)],
      "Today": [moment(now).startOf('day'), moment(now)],
      "Yesterday": [moment(now).subtract(1, "day").startOf('day'), moment(now).subtract(1, "day").endOf('day')],
      "Past 3 days": [moment(now).subtract(3, "day").startOf('day'), moment(now)],
      "Past 7 days": [moment(now).subtract(7, "day").startOf('day'), moment(now)],
      "Past month": [moment(now).subtract(1, "month").startOf('day'), moment(now)],
      "Past 3 months": [moment(now).subtract(3, "month").startOf('month'), moment(now)],
    }
  } else {
    maxDate = false
    startDt = false
    endDt = false
    ranges = {}
  }
  
  let p = {
    local: { format: "MM/DD/YYYY hh:mm A" },
    startDt: startDt,
    endDt: endDt,
    minDate: moment(RAINFALL_MIN_DATE),
    maxDate: moment(maxDate),
    minYear: moment(RAINFALL_MIN_DATE).year(),
    maxYear: moment().year(),
    ranges: ranges,
    rainfallDataType: ownProps.rainfallDataType,
  }
  
  return p
}

const mapDispatchToProps = (dispatch, ownProps) => {
  return {
    dispatchPickRainfallDateTimeRange: payload => {
      dispatch(pickRainfallDateTimeRange({...payload, contextType: ownProps.contextType}))
    }
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(DateTimePicker);