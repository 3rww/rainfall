import React from 'react';
import { connect } from 'react-redux';
import { Modal, Button, Row, Col } from 'react-bootstrap';
import moment from 'moment'
import { unparse } from 'papaparse'
import { saveAs } from 'file-saver'

import DownloadLineChart from './downloadLineChart'
import { buildDownloadRowsAndFields, buildDownloadChartData, CHART_TIMESTAMP_RULE } from './downloadTableUtils'
import './downloadModal.css'

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

    return (

      <Modal
        show={this.props.show}
        onHide={this.props.onHide}
        size="xl"
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
          {/* DOWNLOAD BUTTONS */}
          <Row className="download-modal-download-row">
            <Col sm={3}>
              <p className="mb-0">Download as:</p>
            </Col>
            <Col sm={3}>
              <Button className="w-100" variant="outline-primary" size={'sm'} onClick={this.handleDownloadClick}>
                CSV
              </Button>
            </Col>
          </Row>
          {/* RESULTS CHART */}
          <Row>
            <Col>
              <p className="small download-modal-chart-meta">
                <em>{`${this.props.rows.length} total records across ${this.props.chartSeries.length} sensors`}</em>
              </p>
              <DownloadLineChart rows={this.props.chartRows} series={this.props.chartSeries} />
            </Col>
          </Row>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-primary" onClick={this.props.onHide}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

    )
  }
}

const mapStateToProps = (state, ownProps) => {

  let resultsTableData = ownProps.fetchHistoryItem.results || {}
  let { rows, fields } = buildDownloadRowsAndFields(resultsTableData)
  let { rows: chartRows, series: chartSeries } = buildDownloadChartData(resultsTableData, {
    timestampRule: CHART_TIMESTAMP_RULE.start
  })
  
  return {
    rows: rows,
    chartRows: chartRows,
    chartSeries: chartSeries,
    csv: (rows.length > 0 ? unparse({ fields, data: rows }) : ""),
  }
}

export default connect(mapStateToProps)(DownloadModal);
