import React from 'react';
import { connect } from 'react-redux';
import { Modal, Button, Row, Col, Form } from 'react-bootstrap';
import moment from 'moment'
import { unparse } from 'papaparse'
import { saveAs } from 'file-saver'

import DownloadLineChart from './downloadLineChart'
import {
  buildDownloadRowsAndFields,
  buildDownloadChartData,
  buildSwmmInpSnippet,
  CHART_TIMESTAMP_RULE,
  CHART_SERIES_MODE
} from './downloadTableUtils'
import './downloadModal.css'

/**
* Modal for Individual Data Downloads
*/
class DownloadModal extends React.Component {

  constructor(props) {
    super(props);
    this.handleDownloadClick = this.handleDownloadClick.bind(this);
    this.handleDownloadInpClick = this.handleDownloadInpClick.bind(this);
    this.handleAverageOnlyToggle = this.handleAverageOnlyToggle.bind(this);
    this.state = {
      showAverageOnly: true
    };
  }

  componentDidUpdate(prevProps) {
    if (!prevProps.show && this.props.show && !this.state.showAverageOnly) {
      this.setState({ showAverageOnly: true });
    }
  }

  handleDownloadClick(e) {
    e.preventDefault()
    var blob = new Blob([this.props.csv], { type: "application/csv" });
    saveAs(blob, "rainfall.csv", { autoBom: true })
  }

  handleDownloadInpClick(e) {
    e.preventDefault()
    if (!this.props.hasSwmmData) {
      return
    }

    const blob = new Blob([this.props.inp], { type: "text/plain;charset=utf-8" });
    saveAs(blob, "rainfall_swmm.inp", { autoBom: true })
  }

  handleAverageOnlyToggle(e) {
    this.setState({ showAverageOnly: e.currentTarget.checked });
  }

  render() {

    let fetchKwargs = this.props.fetchHistoryItem.fetchKwargs
    let sensorLocations = fetchKwargs.sensorLocations
    let gauges = sensorLocations.gauge
    let pixels = sensorLocations.pixel
    let chartRows = this.state.showAverageOnly
      ? this.props.chartRowsAverageByType
      : this.props.chartRowsPerSensor
    let chartSeries = this.state.showAverageOnly
      ? this.props.chartSeriesAverageByType
      : this.props.chartSeriesPerSensor
    let chartMetaLabel = `${this.props.rows.length} total records across ${chartSeries.length} sensors`

    return (

      <Modal
        show={this.props.show}
        onHide={this.props.onHide}
        size="xl"
        dialogClassName="min-vw-95"
        animation={false}
        fullscreen={'xl-down'}
      >
        <Modal.Header closeButton>
          <Modal.Title className="w-100">
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
            <Col sm={3}>
              <Button
                className="w-100"
                disabled={!this.props.hasSwmmData}
                variant="outline-primary"
                size={'sm'}
                onClick={this.handleDownloadInpClick}
              >
                SWMM (.inp)
              </Button>
            </Col>
          </Row>
          {/* RESULTS CHART */}
          <Row>
            <Col>
              <p className="small download-modal-chart-meta">
                <em>{chartMetaLabel}</em>
              </p>
              <div
                className="border-top mt-3 py-3"
              >
              <Form.Check
                checked={this.state.showAverageOnly}
                className="download-modal-average-toggle"
                id="download-average-only-toggle"
                label="Average by Type"
                onChange={this.handleAverageOnlyToggle}
                type="switch"
              />
              <DownloadLineChart
                rows={chartRows}
                series={chartSeries}
                showLegend={this.state.showAverageOnly}
              />
              </div>
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
  let { rows: chartRowsPerSensor, series: chartSeriesPerSensor } = buildDownloadChartData(resultsTableData, {
    timestampRule: CHART_TIMESTAMP_RULE.start
  })
  let { rows: chartRowsAverageByType, series: chartSeriesAverageByType } = buildDownloadChartData(resultsTableData, {
    timestampRule: CHART_TIMESTAMP_RULE.start,
    seriesMode: CHART_SERIES_MODE.averageByType
  })
  const inp = buildSwmmInpSnippet(resultsTableData, {
    rollup: ownProps.fetchHistoryItem?.fetchKwargs?.rollup,
    timestampRule: CHART_TIMESTAMP_RULE.start
  })

  return {
    rows: rows,
    chartRowsPerSensor: chartRowsPerSensor,
    chartSeriesPerSensor: chartSeriesPerSensor,
    chartRowsAverageByType: chartRowsAverageByType,
    chartSeriesAverageByType: chartSeriesAverageByType,
    hasSwmmData: chartSeriesPerSensor.length > 0,
    inp: inp,
    csv: (rows.length > 0 ? unparse({ fields, data: rows }) : ""),
  }
}

export default connect(mapStateToProps)(DownloadModal);
