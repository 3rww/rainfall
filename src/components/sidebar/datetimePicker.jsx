
import React from 'react';
import { connect } from 'react-redux';
import { 
  Modal, 
  Button, 
  ButtonToolbar,
  InputGroup, 
  FormControl,
  Row,
  Col
} from 'react-bootstrap'
import moment from 'moment'
// icons
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCalendar, faList } from '@fortawesome/free-solid-svg-icons'
import EventsList from './eventsList';
import DateRangePicker from 'react-bootstrap-daterangepicker';
import { pickRainfallDateTimeRange } from '../../store/actions';
import { selectSelectedEvent, selectEventStats } from '../../store/selectors'

import 'bootstrap-daterangepicker/daterangepicker.css';
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

  handleOnApply(e, p) {
    this.props.dispatchPickRainfallDateTimeRange({
      startDt: p.startDate.format(),
      endDt: p.endDate.format()
    })
  }

  handleClose(e) {
    this.setState({ show: false});
  }

  handleShow(e) {
    this.setState({ show: true});
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
            <EventsList/>
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
            <InputGroup className="datetimepicker-control">
              {/* FORM CONTROL: shows selected datetimes. TODO: make user-editable 
              (requires robust parsing of user input)*/}
              <FormControl
                plaintext 
                readOnly
                placeholder="start and end date/times"
                value={`${this.props.selectedStart} - ${this.props.selectedEnd}`}
                aria-label="start and end dates"
                className="datetimepicker-control"
              />
              <InputGroup.Append>
                {/* Button to show a datetime-range picker */}
                <DateRangePicker
                  id="dtp-show-daterangepicker"
                  startDate={this.props.selectedStart}
                  endDate={this.props.selectedEnd}
                  minDate={"04/01/2000"}
                  maxDate={this.props.maxDate}
                  timePicker={true}
                  timePickerIncrement={15}
                  autoUpdateInput={true}
                  onApply={this.handleOnApply}
                  // parentEl=".scrolling-column"
                >
                  <Button 
                    variant="light"
                    className="datetimepicker-control"
                  >
                      <FontAwesomeIcon icon={faCalendar}/>
                    </Button>
                </DateRangePicker>
                {/* Button to show list of events */}
                <Button 
                  id="dtp-show-eventlistmodal"
                  variant="light"
                  onClick={this.handleShow}
                  className="datetimepicker-control"
                >
                    <FontAwesomeIcon icon={faList}/>
                </Button>                
              </InputGroup.Append>
            </InputGroup>
          </Col>
        </Row>
      </div>
    );
  }
}

function mapStateToProps(state) {
  let selectedEvent = selectSelectedEvent(state)
  let eventStats = selectEventStats(state)
  return {
    selectedStart: moment(selectedEvent.start_dt).format("MM/DD/YYYY hh:mm A"),
    selectedEnd: moment(selectedEvent.end_dt).format("MM/DD/YYYY hh:mm A"),
    maxDate: moment(eventStats.maxDate).format("MM/DD/YYYY hh:mm A")
  }
}

const mapDispatchToProps = (dispatch, ownProps) => {
  return {
    dispatchPickRainfallDateTimeRange: payload => {
      dispatch(pickRainfallDateTimeRange(payload))
    }
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(DateTimePicker);