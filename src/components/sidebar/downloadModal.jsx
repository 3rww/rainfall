import React from 'react';
import { connect } from 'react-redux';
import { Modal, Button, Row, Col } from 'react-bootstrap';
import moment from 'moment'

/**
* Modal for Individual Data Downloads
*/
class DownloadModal extends React.Component {

  render() {

    let fetchKwargs = this.props.fetchHistoryItem.fetchKwargs
    let itemId = this.props.fetchHistoryItem.requestId
    let sensorLocations = fetchKwargs.sensorLocations
    let gauges = sensorLocations.gauge
    let pixels = sensorLocations.pixel
    let hasResults = this.props.fetchHistoryItem.results !== false

    /*
    // holders for data to be rendered in the download table
    let data = []
    let tableRows = []
    let tableHeader = []
    let downloadData = ""
    
    // table columns come from the checked state of the filters, with the ID/label columns first
    let tableColumns = ['timestamp']

    // transform the results into tabular format here:
    // TODO
    
    
    // read the array of objects into a delimited text string.
    // this is what is sent via the File API
    downloadData = unparse(data)

    // convert back to object for rendering the table
    let tableContent = parse(downloadData).data

    // create the preview table
    if (tableContent.length > 0) {
      tableHeader = tableContent[0]
      tableRows = tableContent.slice(1)
    }
    
    
    let content = {
      header: tableHeader !== undefined ? tableHeader : [],
      rows: tableRows !== undefined ? tableRows : [],
      downloadData: downloadData
    }
    */

    return (

      <Modal
        show={this.props.show}
        onHide={this.props.onHide}
        size="lg"
      >
        <Modal.Header closeButton>
          <Modal.Title>
            <Row>
              <Col>
                <h4>{moment(fetchKwargs.startDt).format("DD MMM YYYY, h:mm a")} to {moment(fetchKwargs.endDt).format("DD MMM YYYY, h:mm a")}</h4>
                <hr></hr>
              </Col>
            </Row>
            {/* List Gauges used in the request*/}
            {(gauges.length > 0) ? (
              <Row>
                <Col md={3}>
                  <small>Gauges:</small>
                </Col>
                <Col md={9}>
                  <small>{gauges.map(g => g.label).join(", ")}</small>
                </Col>
              </Row>
            ) : (
                null
              )}

            {/* List Pixels used in the request*/}
            {(pixels.length > 0) ? (
              <Row>
                <Col md={3}>
                  <small>Pixels:</small>
                </Col>
                <Col md={9}>
                  <small>{pixels.length} pixels queried</small>
                </Col>
              </Row>
            ) : (
                null
              )}

            {/* Rollup method */}
            <Row>
              <Col md={3}>
                <small>Interval:</small>
              </Col>
              <Col md={9}>
                <small>{fetchKwargs.rollup}</small>
              </Col>
            </Row>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {/* DOWNLOAD BUTTONS */}
          <Row>
            <Col sm={3}>
              <p>Download as: </p>
            </Col>
            <Col>
              <Button block variant="outline-primary" onClick={this.props.onHide}>
                CSV
              </Button>
              <Button block variant="outline-primary" onClick={this.props.onHide}>
                GeoJSON
              </Button>
            </Col>
          </Row>
          <Row>
            <Col>
              <code>{JSON.stringify(this.props.fetchHistoryItem.results)}</code>
            </Col>
          </Row>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={this.props.onHide}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

    )
  }
}

const mapStateToProps = (state, ownProps) => {
  return {}
}

const mapDispatchToProps = (dispatch, ownProps) => {
  return {}
  // return {
  //   pickDownload: payload => {
  //     dispatch(pickDownload(payload))
  //   }
  // }
}

export default connect(mapStateToProps, mapDispatchToProps)(DownloadModal);