import React from 'react';
import { connect } from 'react-redux';
import { Row, Col, ListGroup, ProgressBar } from 'react-bootstrap';
import moment from 'moment'
// icons
// import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
// import { faSpinner, faCloudRain } from '@fortawesome/free-solid-svg-icons'

// import EventFilterControls from './filters';

import { pickRainfallEvent } from '../../store/features/rainfallThunks'
import { selectRainfallEvents } from '../../store/selectors'

import './eventsList.css'


class EventsList extends React.Component {

  constructor(props) {
    super(props);

    // This binding is necessary to make `this` work in the callback
    this.handleListClick = this.handleListClick.bind(this);
  }

  handleListClick(e) {
    this.props.dispatchPickRainfallEvent(e.eventid)
  }

  render() {

    return (

      <Row>
        <Col>
          <ListGroup variant="flush">
            {
              this.props.events.map((e, i) => {

                let dt0 = moment(e.startDt)
                let dt1 = moment(e.endDt);
                // let hasData = e.data.length > 0;
                // let pct = (e.hours / this.props.maxHours) * 100
                let pct = (e.hours / 48) * 100

                return (
                  <ListGroup.Item
                    action
                    onClick={() => this.handleListClick(e)}
                    key={i}
                    eventKey={e.eventid}
                    // variant={hasData ? "primary" : ""}
                    className="event-list-item"
                  >
                    <small>
                      <Row>
                        <Col xs={7}>
                          {dt0.format("DD MMM YYYY, h:mm a")} &mdash; {dt1.format("DD MMM YYYY, h:mm a")}&nbsp;
                          </Col>
                        <Col xs={5}>
                          {e.hours} hour{(e.hours > 1) ? "s" : ""}
                        </Col>
                        {/* <Col xs={2}>
                          {e.isFetching ? <FontAwesomeIcon icon={faSpinner} pulse/> : ("")}
                          {hasData ? <FontAwesomeIcon icon={faCloudRain}/> : ("")}
                          </Col> */}
                      </Row>
                    </small>
                    <Row>
                      <Col>
                        <ProgressBar
                          className="event-length-bar"
                          now={pct}
                          // label={`${e.hours} hours`} 
                          variant="primary"
                        />
                      </Col>
                    </Row>
                  </ListGroup.Item>
                )

              })
            }
          </ListGroup>
        </Col>
      </Row>

    )
  }
}

function mapStateToProps(state) {
  let events = selectRainfallEvents(state)
  return {
    events: events.list.filter(e => {
      // return all events if filter is set to 24
      if (events.filters.maxHours >= 24) {
        return e
        // otherwise use the filter
      } else {
        if (e.hours <= events.filters.maxHours) {
          return e
        }
      }
    }),
    maxHours: parseFloat(events.stats.longest)
  }
}

const mapDispatchToProps = (dispatch, ownProps) => {
  return {
    dispatchPickRainfallEvent: eventid => {
      // console.log({ eventid: eventid, contextType: ownProps.contextType })
      dispatch(pickRainfallEvent({ eventid: eventid, contextType: ownProps.contextType }))
      // ownProps.handleClose()
    }
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(EventsList);
