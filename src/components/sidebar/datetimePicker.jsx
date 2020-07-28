
import React from 'react';
import { connect } from 'react-redux';
import {
  Modal,
  Button,
  ButtonToolbar,
  InputGroup,
  FormControl,
  Row,
  Col,
  Spinner
} from 'react-bootstrap'
import moment from 'moment'
import DateTimeRangeContainer from 'react-advanced-datetimerange-picker'
// icons
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCalendar, faList } from '@fortawesome/free-solid-svg-icons'

import EventsList from './eventsList';
import { pickRainfallDateTimeRange } from '../../store/actions';
import { selectSelectedEvent, selectEventStats, eventIsSelected } from '../../store/selectors'
import { RAINFALL_TYPES } from '../../store/config'

import './datetimePicker.scss'

class DateTimePicker extends React.Component {
  constructor(props) {
    super(props);

    this.handleOnApply = this.handleOnApply.bind(this);
    this.handleShow = this.handleShow.bind(this);
    this.handleClose = this.handleClose.bind(this);

    this.state = {
      show: false
    }

  }

  handleOnApply(startDt, endDt) {

    this.props.dispatchPickRainfallDateTimeRange({
      startDt: startDt.toISOString(),
      endDt: endDt.toISOString()
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
            <EventsList />
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

            {/* <InputGroup className="datetimepicker-control">
              <FormControl
                plaintext 
                readOnly
                placeholder="start and end date/times"
                value={`${this.props.startDt} - ${this.props.endDt}`}
                aria-label="start and end dates"
                className="datetimepicker-control"
              />
              <InputGroup.Append>
                
                <DateRangePicker
                  id="dtp-show-daterangepicker"
                  initialSettings={{
                    autoUpdateInput: true,
                    locale: {
                      cancelLabel: 'Clear',
                      format: "MM/DD/YYYY hh:mm A"
                    },
                    startDate: this.props.startDt,
                    endDate: this.props.endDt,
                    timePicker: true,
                    timePickerIncrement: 15,
                    minDate: new Date("04/01/2000"),
                    maxDate: this.props.maxDate
                  }}
                >
                  <Button 
                    variant="light"
                    className="datetimepicker-control"
                  >
                    <FontAwesomeIcon icon={faCalendar}/>
                  </Button>
                </DateRangePicker>
                
                <Button 
                  id="dtp-show-eventlistmodal"
                  variant="light"
                  onClick={this.handleShow}
                  className="datetimepicker-control"
                >
                    <FontAwesomeIcon icon={faList}/>
                </Button>                
              </InputGroup.Append>
            </InputGroup> */}

            {/* <Button
              id="dtp-show-eventlistmodal"
              variant="light"
              onClick={this.handleShow}
              className="datetimepicker-control"
            >
              <FontAwesomeIcon icon={faList} />
            </Button> */}

            {(this.props.startDt !== false && this.props.endDt !==false) ? (
              <DateTimeRangeContainer
                ranges={this.props.ranges}
                start={this.props.startDt}
                end={this.props.endDt}
                local={this.props.local}
                maxDate={this.props.maxDate}
                applyCallback={this.handleOnApply}
                years={[2000, moment().year()]}
                pastSearchFriendly
                className="MyDateTimeRangeContainer"
              >
                <FormControl
                  id="formControlsTextB"
                  type="text"
                  label="Text"
                  placeholder="start and end date/times"
                  style={{ cursor: "pointer" }}
                  defaultValue={`${this.props.startDt.format("MM/DD/YYYY hh:mm A")} - ${this.props.endDt.format("MM/DD/YYYY hh:mm A")}`}
                />
              </DateTimeRangeContainer>
            ) : (
              <Spinner
                animation="grow"
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
  let selectedEvent = selectSelectedEvent(state)
  let hasEvent = eventIsSelected(state)
  let eventStats = selectEventStats(state)

  // calculate different available ranges, depending on rainfall data type
  let ranges = {}
  if (ownProps.rainfallDataType == RAINFALL_TYPES.historic && eventStats.maxDate !== null) {
    let maxDate = moment(eventStats.maxDate)
    ranges = {
      "Latest month": [maxDate.subtract(1, 'months'), maxDate],
      "Latest 3 months": [maxDate.subtract(2, 'months'), maxDate],
      "Latest 6 months": [maxDate.subtract(6, 'months'), maxDate],
      "Latest 12 months": [maxDate.subtract(12, 'months'), maxDate],
      "Last Year": [maxDate.subtract(1, "years").endOf("year"), maxDate.subtract(1, "years").startOf("year")],
    }
  } else if (ownProps.rainfallDataType == RAINFALL_TYPES.realtime) {
    ranges = {
      "Past 2 hours": [moment().subtract(2, 'hours'), moment()],
      "Past 4 hours": [moment().subtract(4, 'hours'), moment()],
      "Past 6 hours": [moment().subtract(6, 'hours'), moment()],
      "Past 12 hours": [moment().subtract(12, 'hours'), moment()],
      "Past 24 hours": [moment().subtract(24, 'hours'), moment()],
      "Past 48 hours": [moment().subtract(48, 'hours'), moment()],
      "Today": [moment().startOf('day'), moment()],
      "Yesterday": [moment().subtract(1, "days").startOf('day'), moment().subtract(1, "days").endOf('day')],
      "Past 3 days": [moment().subtract(3, "days").startOf('day'), moment()],
      "Past 7 days": [moment().subtract(7, "days").startOf('day'), moment()],
      "Past month": [moment().subtract(1, "months").startOf('day'), moment()],
      "Past 3 months": [moment().subtract(3, "months").startOf('month'), moment()],
    }
  } else {
    ranges = {}
  }

  console.log(ranges)
  let p = {
    hasEvent: hasEvent,
    local: { format: "MM/DD/YYYY hh:mm A" },
    startDt: hasEvent ? moment(selectedEvent.start_dt): false,
    endDt: hasEvent ? moment(selectedEvent.end_dt): false,
    minDate: moment(eventStats.maxDate).subtract(1, 'months').startOf('month'),
    maxDate: moment(eventStats.maxDate),
    ranges: ranges
  }
  // console.log(p)
  return p
}

const mapDispatchToProps = (dispatch, ownProps) => {
  return {
    dispatchPickRainfallDateTimeRange: payload => {
      dispatch(pickRainfallDateTimeRange(payload))
    }
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(DateTimePicker);