import React, { useCallback, useMemo, lazy, Suspense } from 'react';
import { Modal, Button, Row, Col, Form } from 'react-bootstrap';
import { unparse } from 'papaparse';
import { saveAs } from 'file-saver';

import {
  buildDownloadRowsAndFields,
  buildDownloadChartData,
  buildSwmmInpSnippet,
  CHART_TIMESTAMP_RULE,
  CHART_SERIES_MODE
} from './downloadTableUtils';
import { formatDateTime } from '../../store/utils/dateTime';
import './downloadModal.css';

const DownloadLineChart = lazy(() => import('./downloadLineChart'));

const DownloadModal = ({
  show,
  onHide,
  fetchHistoryItem,
  seriesMode = CHART_SERIES_MODE.averageByType,
  onSeriesModeChange
}) => {

  const resultsTableData = fetchHistoryItem?.results || {};
  const rollup = fetchHistoryItem?.fetchKwargs?.rollup;

  const rowsAndFields = useMemo(() => buildDownloadRowsAndFields(resultsTableData), [resultsTableData]);

  const rowCount = useMemo(() => Object.values(resultsTableData).reduce((sum, sensorRows) => {
    if (!Array.isArray(sensorRows)) {
      return sum;
    }

    const sensorRowCount = sensorRows.reduce((sensorSum, sensorRow) => (
      sensorSum + (Array.isArray(sensorRow?.data) ? sensorRow.data.length : 0)
    ), 0);

    return sum + sensorRowCount;
  }, 0), [resultsTableData]);

  const averageChartData = useMemo(() => buildDownloadChartData(resultsTableData, {
    timestampRule: CHART_TIMESTAMP_RULE.start,
    seriesMode: CHART_SERIES_MODE.averageByType
  }), [resultsTableData]);

  const perSensorChartData = useMemo(() => buildDownloadChartData(resultsTableData, {
    timestampRule: CHART_TIMESTAMP_RULE.start
  }), [resultsTableData]);

  const swmmInp = useMemo(() => buildSwmmInpSnippet(resultsTableData, {
    rollup,
    timestampRule: CHART_TIMESTAMP_RULE.start
  }), [resultsTableData, rollup]);

  const hasAnyResultsData = rowCount > 0;

  const handleDownloadClick = useCallback((event) => {
    event.preventDefault();

    const csv = rowsAndFields.rows.length > 0
      ? unparse({ fields: rowsAndFields.fields, data: rowsAndFields.rows })
      : '';

    if (csv.length === 0) {
      return;
    }

    const blob = new Blob([csv], { type: 'application/csv' });
    saveAs(blob, 'rainfall.csv', { autoBom: true });
  }, [rowsAndFields.fields, rowsAndFields.rows]);

  const handleDownloadInpClick = useCallback((event) => {
    event.preventDefault();

    if (!hasAnyResultsData) {
      return;
    }

    const blob = new Blob([swmmInp], { type: 'text/plain;charset=utf-8' });
    saveAs(blob, 'rainfall_swmm.inp', { autoBom: true });
  }, [hasAnyResultsData, swmmInp]);

  const handleAverageOnlyToggle = useCallback((event) => {
    event.stopPropagation();
    onSeriesModeChange?.(
      event.target.checked ? CHART_SERIES_MODE.averageByType : CHART_SERIES_MODE.perSensor
    );
  }, [onSeriesModeChange]);

  const fetchKwargs = fetchHistoryItem.fetchKwargs;
  const sensorLocations = fetchKwargs.sensorLocations;
  const gauges = sensorLocations.gauge;
  const pixels = sensorLocations.pixel;
  const totalSensors = gauges.length + pixels.length;

  const showAverageOnly = seriesMode === CHART_SERIES_MODE.averageByType;
  const chartData = showAverageOnly ? averageChartData : perSensorChartData;
  const chartMetaLabel = `${rowCount} total records across ${totalSensors} sensors`;

  return (
    <Modal
      show={show}
      onHide={onHide}
      size="xl"
      dialogClassName="min-vw-95"
      animation={false}
      fullscreen={'xl-down'}
      onClick={(event) => event.stopPropagation()}
    >
      <Modal.Header closeButton>
        <Modal.Title className="w-100">
          <Row>
            <Col>
              <h4>{formatDateTime(fetchKwargs.startDt, 'DD MMM YYYY, h:mm a')} to {formatDateTime(fetchKwargs.endDt, 'DD MMM YYYY, h:mm a')}</h4>
              <hr></hr>
            </Col>
          </Row>

          {gauges.length > 0 ? (
            <Row>
              <Col md={3}>
                <small>Gauges:</small>
              </Col>
              <Col md={9}>
                <small>{gauges.map((gauge) => gauge.label).join(', ')}</small>
              </Col>
            </Row>
          ) : null}

          {pixels.length > 0 ? (
            <Row>
              <Col md={3}>
                <small>Pixels:</small>
              </Col>
              <Col md={9}>
                <small>{pixels.length} pixels queried</small>
              </Col>
            </Row>
          ) : null}

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
        <Row className="download-modal-download-row">
          <Col sm={3}>
            <p className="mb-0">Download as:</p>
          </Col>
          <Col sm={3}>
            <Button className="w-100" variant="outline-primary" size={'sm'} onClick={handleDownloadClick}>
              CSV
            </Button>
          </Col>
          <Col sm={3}>
            <Button
              className="w-100"
              disabled={!hasAnyResultsData}
              variant="outline-primary"
              size={'sm'}
              onClick={handleDownloadInpClick}
            >
              SWMM (.inp)
            </Button>
          </Col>
        </Row>

        <Row>
          <Col>
            <p className="small download-modal-chart-meta">
              <em>{chartMetaLabel}</em>
            </p>
            <div className="border-top mt-3 py-3">
              <Form.Check
                checked={showAverageOnly}
                className="download-modal-average-toggle"
                id="download-average-only-toggle"
                label="Average by Type"
                onChange={handleAverageOnlyToggle}
                type="switch"
              />
              <Suspense fallback={<p className="small mb-0"><em>Loading chart…</em></p>}>
                <DownloadLineChart
                  rows={chartData.rows}
                  series={chartData.series}
                  showLegend={showAverageOnly}
                />
              </Suspense>
            </div>
          </Col>
        </Row>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-primary" onClick={onHide}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default DownloadModal;
