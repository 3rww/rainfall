import React from 'react';
import { connect } from 'react-redux';
import { Row, Col, ListGroup, Button, ButtonToolbar, ButtonGroup } from 'react-bootstrap';
import { keys } from 'lodash-es'
import moment from 'moment'
// icons
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSpinner, faCloudRain } from '@fortawesome/free-solid-svg-icons'


import { pickDownload } from '../../store/actions'


/**
* Layout Component. Everything on the page under the Nav: Controls and Map.
*/
class DownloadsList extends React.Component {

  constructor(props, context) {
    super(props, context);

    this.handleShow = this.handleShow.bind(this);
    this.handleClose = this.handleClose.bind(this);
    this.handleListClick = this.handleListClick.bind(this);

    this.state = {
      show: false,
      showWhich: null,
      content: {
        DownloadButton: {
          title: (
            <div>
              Download
            </div>
          ),
          content: ``
        },
        // API Call Button: {
        //   title:"Map Legend",
        //   content: legend
        // }
      }
    };
  }

  handleClose(e) {
    this.setState({ show: false, showWhich: null });
  }

  handleShow(e) {
    console.log(e.target.id)
    this.setState({ show: true, showWhich: e.target.id });
  }

  handleListClick(fh) {
    this.props.pickDownload(fh)
  }

  render() {

    return (

      <ListGroup variant="flush">

        {this.props.fetchHistory.map((fh, idx) => {

          let sensors = fh.fetchKwargs.sensorLocations
          let event = fh.fetchKwargs.selectedEvent
          let hasResults = fh.results !== false

          return (
            <ListGroup.Item 
              action
              key={idx} 
              // variant={hasResults ? "primary" : ""}
              active={fh.isActive}
              onClick={() => this.handleListClick(fh)}
            >
              <Row noGutters>
                <Col>

                  {/* Start and End Time */}
                  <Row noGutters>
                      <Col>{moment(event.start_dt).format("DD MMM YYYY, h:mm a")} &mdash; {moment(event.end_dt).format("DD MMM YYYY, h:mm a")}</Col>
                  </Row>
                  <hr></hr>
                  {/* List Gauges or Basins used in the request*/}
                  {keys(sensors).filter(s => s !== 'pixel').map((s, sidx) => {
                    if (sensors[s].length > 0) {
                      return (
                        <Row noGutters key={sidx}>
                          <Col xs={4}>{s}</Col>
                          <Col><small>{sensors[s].map(sensorId => sensorId.value).join(",")}</small></Col>
                        </Row>
                      )
                    }
                  })}
                  <hr></hr>
                  {/* Download Buttons */}
                  {
                    // hasResults ? (
                    //   <Row noGutters>
                    //     <Col>
                    //       <ButtonToolbar aria-label="Download and Playback Toolbar">
                    //         <ButtonGroup className="mr-2" aria-label="First Group">
                    //           <Button size="sm">View & Download</Button>
                    //         </ButtonGroup>
                    //         {/* <ButtonGroup aria-label="Third group">
                    //         <Button>Play|Pause</Button>
                    //         <Button>Rewind</Button>
                    //       </ButtonGroup> */}
                    //       </ButtonToolbar>
                    //     </Col>
                    //   </Row>
                    // ) : ("")
                  }


                </Col>

                <Col sm={2}>
                  {
                    fh.isFetching ? (
                      <span className="fa-layers fa-fw">
                        <FontAwesomeIcon icon={faSpinner} pulse size="2x"/>
                        <FontAwesomeIcon icon={faCloudRain} size="1x" transform="right-4"/>
                      </span>
                    ) : ("")
                  }
                </Col>
              </Row>





            </ListGroup.Item>
          )
        })}

      </ListGroup>

    )
  }
}

const mapStateToProps = (state) => {
  let hasSelections = keys(state.fetchKwargs.sensorLocations).filter(k => state.fetchKwargs.sensorLocations[k].length > 0)
  return {
    fetchHistory: state.fetchHistory,
    hasDownloads: state.fetchHistory.length > 0,
    hasKwargs: !hasSelections.length > 0
  }
}

const mapDispatchToProps = (dispatch, ownProps) => {
  return {
    pickDownload: payload => {
      dispatch(pickDownload(payload))
    }
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(DownloadsList);