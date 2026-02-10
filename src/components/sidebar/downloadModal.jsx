import React from 'react';
import { connect } from 'react-redux';
import { Modal, Button, Row, Col, Tabs, Tab } from 'react-bootstrap';
import moment from 'moment'
import { unparse } from 'papaparse'
import { saveAs } from 'file-saver'
import { keys } from 'lodash-es'

import { ResultsTable } from './resultsTable'

const TABLE_ROW_LIMIT = 50

/**
* Modal for Individual Data Downloads
*/
class DownloadModal extends React.Component {

  constructor(props) {
    super();
    this.handleDownloadClick = this.handleDownloadClick.bind(this);
  }

  handleDownloadClick(e) {
    e.preventDefault()
    var blob = new Blob([this.props.csv], { type: "application/csv" });
    saveAs(blob, "rainfall.csv", { autoBom: true })
  }  

  render() {

    let fetchKwargs = this.props.fetchHistoryItem.fetchKwargs
    let sensorLocations = fetchKwargs.sensorLocations
    let gauges = sensorLocations.gauge
    let pixels = sensorLocations.pixel

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
        dialogClassName="min-vw-95"
        animation={false}
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
          <Tabs defaultActiveKey="results-table" id="results-types" variant="pills" mountOnEnter={true}>
            <Tab eventKey="results-table" title="Table" className="my-3">
              {/* DOWNLOAD BUTTONS */}
              <Row>
                <Col sm={3}>
                  <p>Download as: </p>
                </Col>
                <Col sm={3}>
                  <Button className="w-100" variant="outline-primary" size={'sm'} onClick={this.handleDownloadClick}>
                    CSV
                  </Button>
                  {/* <Button block variant="outline-primary" onClick={this.props.onHide}>
                    GeoJSON
                  </Button> */}
                </Col>
              </Row>
              {/* RESULTS TABLE */}
              <Row>
                <Col>
                  <p className="small"><em>{`${this.props.rows.length} total records, showing ${TABLE_ROW_LIMIT}`}</em></p>
                  <ResultsTable rows={this.props.rows.slice(0,TABLE_ROW_LIMIT)} header={this.props.header}/>
                  <p className="small"><em></em></p>
                </Col>
              </Row>
            </Tab>
            <Tab eventKey="results-graph" title="Graph" className="my-3">
              <p className="small"><em>Coming soon: results in an interactive graph</em></p>
            </Tab>
          </Tabs>          
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

  let resultsTableData = ownProps.fetchHistoryItem.results
  
  let allRows = []
  keys(resultsTableData).forEach(s => {
    let sensorRows = resultsTableData[s]
    sensorRows.forEach(sr => {
      let rows = sr.data.map(srd => {
        return { ...srd, id: sr.id, type: s}
      })
      allRows = allRows.concat(rows)
    })
  })
  
  return {
    header: (allRows.length > 0 ? keys(allRows[0]) : []),
    rows: (allRows.length > 0 ? allRows : []),
    csv: (allRows.length > 0 ? unparse(allRows) : ""),
  }
}

export default connect(mapStateToProps)(DownloadModal);
