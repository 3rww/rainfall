import React from 'react';
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
    this.derivedCache = null;
  }

  componentDidUpdate(prevProps) {
    if (!prevProps.show && this.props.show && !this.state.showAverageOnly) {
      this.setState({ showAverageOnly: true });
    }
  }

  getResultsTableData() {
    return this.props.fetchHistoryItem?.results || {}
  }

  getRollup() {
    return this.props.fetchHistoryItem?.fetchKwargs?.rollup
  }

  getOrCreateDerivedCache() {
    const resultsTableData = this.getResultsTableData()
    const rollup = this.getRollup()

    if (
      this.derivedCache
      && this.derivedCache.resultsTableData === resultsTableData
      && this.derivedCache.rollup === rollup
    ) {
      return this.derivedCache
    }

    this.derivedCache = {
      resultsTableData,
      rollup,
      rowCount: null,
      rowsAndFields: null,
      chartAverageByType: null,
      chartPerSensor: null,
      inp: null
    }

    return this.derivedCache
  }

  getRowsAndFields() {
    const cache = this.getOrCreateDerivedCache()
    if (cache.rowsAndFields === null) {
      cache.rowsAndFields = buildDownloadRowsAndFields(cache.resultsTableData)
    }
    return cache.rowsAndFields
  }

  getRowCount() {
    const cache = this.getOrCreateDerivedCache()
    if (cache.rowCount !== null) {
      return cache.rowCount
    }

    cache.rowCount = Object.values(cache.resultsTableData).reduce((sum, sensorRows) => {
      if (!Array.isArray(sensorRows)) {
        return sum
      }

      const sensorRowCount = sensorRows.reduce((sensorSum, sensorRow) => (
        sensorSum + (Array.isArray(sensorRow?.data) ? sensorRow.data.length : 0)
      ), 0)

      return sum + sensorRowCount
    }, 0)

    return cache.rowCount
  }

  getAverageChartData() {
    const cache = this.getOrCreateDerivedCache()
    if (cache.chartAverageByType === null) {
      cache.chartAverageByType = buildDownloadChartData(cache.resultsTableData, {
        timestampRule: CHART_TIMESTAMP_RULE.start,
        seriesMode: CHART_SERIES_MODE.averageByType
      })
    }
    return cache.chartAverageByType
  }

  getPerSensorChartData() {
    const cache = this.getOrCreateDerivedCache()
    if (cache.chartPerSensor === null) {
      cache.chartPerSensor = buildDownloadChartData(cache.resultsTableData, {
        timestampRule: CHART_TIMESTAMP_RULE.start
      })
    }
    return cache.chartPerSensor
  }

  getInp() {
    const cache = this.getOrCreateDerivedCache()
    if (cache.inp === null) {
      cache.inp = buildSwmmInpSnippet(cache.resultsTableData, {
        rollup: cache.rollup,
        timestampRule: CHART_TIMESTAMP_RULE.start
      })
    }
    return cache.inp
  }

  hasAnyResultsData() {
    return this.getRowCount() > 0
  }

  handleDownloadClick(e) {
    e.preventDefault()
    const { rows, fields } = this.getRowsAndFields()
    const csv = rows.length > 0 ? unparse({ fields, data: rows }) : ""
    if (csv.length === 0) {
      return
    }
    var blob = new Blob([csv], { type: "application/csv" });
    saveAs(blob, "rainfall.csv", { autoBom: true })
  }

  handleDownloadInpClick(e) {
    e.preventDefault()
    if (!this.hasAnyResultsData()) {
      return
    }

    const blob = new Blob([this.getInp()], { type: "text/plain;charset=utf-8" });
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
    let totalSensors = gauges.length + pixels.length
    const averageChartData = this.getAverageChartData()
    const perSensorChartData = this.state.showAverageOnly
      ? null
      : this.getPerSensorChartData()
    const chartRows = this.state.showAverageOnly
      ? averageChartData.rows
      : perSensorChartData.rows
    const chartSeries = this.state.showAverageOnly
      ? averageChartData.series
      : perSensorChartData.series
    let chartMetaLabel = `${this.getRowCount()} total records across ${totalSensors} sensors`
    const hasSwmmData = this.hasAnyResultsData()

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
                disabled={!hasSwmmData}
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

export default DownloadModal;
