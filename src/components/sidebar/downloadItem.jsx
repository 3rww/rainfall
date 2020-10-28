import React from 'react';
import { connect } from 'react-redux';
import { Row, Col, Button, Card } from 'react-bootstrap';
import moment from 'moment'

import DownloadModal from './downloadModal'
import { pickDownload } from '../../store/actions'


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
    // console.log(e)
    this.setState({ show: true });
    this.props.dispatchPickDownload()
  }  

  render() {

    let fetchKwargs = this.props.fetchHistoryItem.fetchKwargs
    let itemId = this.props.fetchHistoryItem.requestId
    let sensorLocations = fetchKwargs.sensorLocations
    let gauges = sensorLocations.gauge
    let pixels = sensorLocations.pixel
    let hasResults = this.props.fetchHistoryItem.results !== false

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
            <Col sm={3}>
              <p><strong></strong>Gauges:</p>
            </Col>
            <Col md={9}>
              <p>{gauges.map(g => g.label).join(", ")}</p>
            </Col>
          </Row>
        ) : (
            null
          )}

        {/* List Pixels used in the request*/}
        {(pixels.length > 0) ? (
          <Row>
            <Col md={3}>
              <p>Pixels:</p>
            </Col>
            <Col md={9}>
              <p>{pixels.length} pixels queried</p>
            </Col>
          </Row>
        ) : (
            null
          )}

        {/* Rollup method */}
        <Row>
          <Col md={3}>
            <p>Interval:</p>
          </Col>
          <Col md={9}>
            <p>{fetchKwargs.rollup}</p>
          </Col>
        </Row>
        <p></p>


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
  return {}
}

const mapDispatchToProps = (dispatch, ownProps) => {
  return {
    dispatchPickDownload: payload => {
      let p = {...ownProps.fetchHistoryItem, contextType: ownProps.contextType}
      // console.log(p)
      dispatch(pickDownload(p))
    }
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(DownloadsItem);