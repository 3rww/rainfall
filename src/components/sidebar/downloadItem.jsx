import React from 'react';
import { connect } from 'react-redux';
import { Row, Col, Button, Card } from 'react-bootstrap';
import moment from 'moment'

import DownloadModal from './downloadModal'
import { pickDownload } from '../../store/middleware'
// import { reFetchRainfallDataFromApiV2 } from '../../store/middleware'

import './downloadItem.scss'

/**
* Downloads Item Component. 
*/
class DownloadsItem extends React.Component {

  constructor(props, context) {
    super(props, context);

    this.handleShow = this.handleShow.bind(this);
    this.handleClose = this.handleClose.bind(this);
    this.state = {
      show: false
    }
  }

  handleClose(e) {
    // console.log(e)
    this.setState({ show: false });
  }

  handleShow(e) {

    this.setState({ show: true });
    if (!this.props.fetchHistoryItem.isActive) {
      console.log(e)
      console.log("Loading data from", this.props.fetchHistoryItem.requestId, "to the map")
      this.props.dispatchPickDownload()
    }

  }

  // handleDownloadClick() {
  //   this.props.fetchRainfallData({
  //     rainfallDataType: this.props.rainfallDataType,
  //     contextType: this.props.contextType
  //   })
  // }

  render() {
    let fhi = this.props.fetchHistoryItem
    let fetchKwargs = fhi.fetchKwargs
    let sensorLocations = fetchKwargs.sensorLocations
    let gauges = sensorLocations.gauge
    let pixels = sensorLocations.pixel
    let hasResults = fhi.results !== false
    let pKwargs = fhi.processedKwargs

    // let reGetButton = includes(
    //   ['deferred', 'failed', "does not exist", 'error'], 
    //   this.props.fetchHistoryItem.status
    // )

    return (
      <div className="download-item-wrapper">

        {/* Datetime Range */}
        <Row>
          <Col sm={12}>
            <Card.Title>{moment(fetchKwargs.startDt).format("DD MMM YYYY, h:mm a")} to {moment(fetchKwargs.endDt).format("DD MMM YYYY, h:mm a")}</Card.Title>
            <hr></hr>
          </Col>
        </Row>


        {/* List Gauges used in the request*/}
        {(gauges.length > 0) ? (
          <Row>
            <Col lg={3}>
              <p className="di-header">Gauges:</p>
            </Col>
            <Col lg={9}>
              <p>{gauges.map(g => g.label).join(", ")}</p>
            </Col>
          </Row>
        ) : (
            null
          )}

        {/* List Pixels used in the request*/}
        {(pixels.length > 0) ? (
          <Row>
            <Col lg={3}>
              <p className="di-header">Pixels:</p>
            </Col>
            <Col lg={9}>
              <p>{pixels.length} pixels queried</p>
            </Col>
          </Row>
        ) : (
            null
          )}

        {/* Rollup method */}
        <Row>
          <Col lg={3}>
            <p className="di-header">Aggregation:</p>
          </Col>
          <Col lg={9}>
            <p>{fetchKwargs.rollup}</p>
          </Col>
        </Row>

        {(pKwargs === undefined) ? (
          null
        ) : (
          <Row>
            <Col lg={3}>
              <p className="di-header">Date/time range queried:</p>
            </Col>
            <Col lg={9}>
              <p>{pKwargs.start_dt}/{pKwargs.end_dt}</p>
            </Col>
          </Row>
        )}


        {/* Download Buttons */}
        {
          hasResults ? (
            <Row>
              <Col>
                <Button
                  variant="outline-primary"
                  size="sm"
                  onClick={this.handleShow}
                >
                  View and Download Results Table
                </Button>

                {/* <ButtonToolbar aria-label="Download and Playback Toolbar">
              <ButtonGroup className="mr-2" aria-label="First Group">
               <Button size="sm">View & Download</Button>
              </ButtonGroup>
              <ButtonGroup aria-label="Third group">
              <Button>Play|Pause</Button>
              <Button>Rewind</Button>
             </ButtonGroup> 
             </ButtonToolbar> */}

              </Col>
            </Row>
          ) : (null)
        }
        {/* {
          reGetButton ? (
            <Row>
              <Col>
                <Button
                  variant="outline-primary"
                  size="sm"
                  onClick={this.handleShow}
                >
                  View and Download Results Table
                </Button>
              </Col>
            </Row>            
          ) : (null)
        } */}

        <DownloadModal
          show={this.state.show}
          onHide={this.handleClose}
          fetchHistoryItem={this.props.fetchHistoryItem}
        />

      </div>

    )
  }
}

const mapStateToProps = (state, ownProps) => {
  return {
    ...ownProps,

  }
}

const mapDispatchToProps = (dispatch, ownProps) => {
  return {
    dispatchPickDownload: payload => {
      let p = { ...ownProps.fetchHistoryItem, contextType: ownProps.contextType }
      // console.log(p)
      dispatch(pickDownload(p))
    },
    // dispatchDownloadAgain: payload => {
    //   dispatch(reFetchRainfallDataFromApiV2(payload))
    // }
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(DownloadsItem);