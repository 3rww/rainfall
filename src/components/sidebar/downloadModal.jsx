import React, { useCallback, useMemo, useState, lazy, Suspense } from 'react';
import { Modal, Button, Form, Alert, ProgressBar } from 'react-bootstrap';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  makeSelectResultPresentation, makeSelectSensorSummaries, preferencesChanged,
  exportRequested, operationCanceled, saveRequested
} from '../../store/features/resultsPresentationSlice';
import { formatDateTime } from '../../store/utils/dateTime';
import './downloadModal.css';
const DownloadLineChart = lazy(() => import('./downloadLineChart'));

const DownloadModal = ({ show, onHide, fetchHistoryItem, contextType }) => {
  const dispatch = useAppDispatch();
  const arg = useMemo(() => ({ contextType, requestId: fetchHistoryItem.requestId }), [contextType, fetchHistoryItem.requestId]);
  const selectPresentation = useMemo(makeSelectResultPresentation, []);
  const selectSummaries = useMemo(makeSelectSensorSummaries, []);
  const ui = useAppSelector(state => selectPresentation(state, arg));
  const sensors = useAppSelector(state => selectSummaries(state, arg));
  const [search, setSearch] = useState('');
  const kwargs = fetchHistoryItem.fetchKwargs;
  const change = values => dispatch(preferencesChanged({ ...arg, ...values }));
  const changeRange = useCallback(range => dispatch(preferencesChanged({ ...arg, range })), [dispatch, arg]);
  const selected = ui.selected || [];
  const records = sensors.reduce((n, s) => n + s.recordCount, 0);
  const available = fetchHistoryItem.detailsAvailable;
  const previewPending = ui.operations?.preview?.status === 'pending';
  return <Modal show={show} onHide={onHide} size="xl" dialogClassName="min-vw-95" animation={false} fullscreen="xl-down" onClick={e => e.stopPropagation()}>
    <Modal.Header closeButton><Modal.Title>
      <h4>{formatDateTime(kwargs.startDt, 'DD MMM YYYY, h:mm a')} to {formatDateTime(kwargs.endDt, 'DD MMM YYYY, h:mm a')}</h4>
      <small>Interval: {kwargs.rollup}</small>
      {kwargs.sensorLocations.gauge.length > 0 && <p className="small mb-0">Gauges: {kwargs.sensorLocations.gauge.map(g => g.label).join(', ')}</p>}
      {kwargs.sensorLocations.pixel.length > 0 && <p className="small mb-0">Pixels: {kwargs.sensorLocations.pixel.length} pixels queried</p>}
    </Modal.Title></Modal.Header>
    <Modal.Body>
      {!available && <Alert variant="danger">Detailed results are unavailable. Please rerun this query.</Alert>}
      <div className="download-modal-download-row">
        <div className="d-flex flex-wrap gap-3 align-items-start">
        <p className="mb-0">Download as:</p>
        {['csv', 'swmm'].map(format => {
          const op = ui.operations?.[format];
          return <div key={format}>
            <Button size="sm" variant="outline-primary" disabled={!available || !records || op?.status === 'pending'} onClick={() => dispatch(exportRequested({ ...arg, format }))}>{format === 'csv' ? 'CSV' : 'SWMM (.inp)'}</Button>
            {op?.status === 'ready' && <Button size="sm" onClick={() => dispatch(saveRequested({ ...arg, format }))}>Ready to save {format.toUpperCase()}</Button>}
            {op?.status === 'failed' && <p role="alert">{op.error}</p>}
          </div>;
        })}
        </div>
        {['csv', 'swmm'].map(format => {
          const op = ui.operations?.[format];
          if (op?.status !== 'pending') return null;
          const percent = op.progress?.done ? 100 : op.progress?.total ? Math.min(100, Math.round(100 * op.progress.processed / op.progress.total)) : null;
          return <div key={format} className="download-modal-export-progress mt-3">
            <div className="d-flex align-items-center justify-content-between mb-1">
              <small>{format.toUpperCase()}</small>
              <Button size="sm" variant="link" className="p-0" onClick={() => dispatch(operationCanceled({ ...arg, format }))}>Cancel {format.toUpperCase()}</Button>
            </div>
            <ProgressBar><ProgressBar animated striped now={percent ?? 100} label={percent === null ? 'Preparing…' : `${percent}%`} aria-label={`${format.toUpperCase()} export progress`} /></ProgressBar>
          </div>;
        })}
      </div>
      <p className="small download-modal-chart-meta"><em>{records} total records across {sensors.length} sensors</em></p>
      <div className="border-top mt-3 py-3">
        <p className="small">{ui.preview ? `${ui.preview.interval[0].toUpperCase()}${ui.preview.interval.slice(1)} preview; downloads contain ${kwargs.rollup.toLowerCase()} observations.` : 'Downloads contain the original observations.'}</p>
        {previewPending && <p role="status">Preparing chart…</p>}
        {ui.operations?.preview?.status === 'failed' && <Alert variant="danger">{ui.operations.preview.error}</Alert>}
        {ui.preview && <Suspense fallback={<p>Loading chart…</p>}><DownloadLineChart rows={ui.preview.rows} series={ui.preview.series} range={ui.preview.range} onRangeChange={changeRange} /></Suspense>}
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
          <p class="small text-muted">Drag horizontally to zoom. Double-click to reset. Times are Eastern.</p>
          <Button variant="link" size="sm" onClick={() => changeRange({})}>Reset chart zoom</Button>
        </div>
        <div className="download-modal-chart-controls border-top mt-3 pt-3">
          <Form.Check checked={ui.mode !== 'perSensor'} id="download-average-only-toggle" label="Average by Type" type="switch" onChange={e => change({ mode: e.target.checked ? 'averageByType' : 'perSensor' })} />
          {ui.mode === 'perSensor' && <fieldset className="mt-3" aria-label="Individual sensor selection">
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
              <p className="fs-6 mb-0">Individual sensors ({selected.length}/{sensors.length})</p>
              <div className="btn-group btn-group-sm" role="group" aria-label="Sensor selection controls">
                <Button variant="outline-primary" disabled={selected.length === sensors.length} onClick={() => change({ selected: sensors.map(s => s.key) })}>Select all</Button>
                <Button variant="outline-primary" disabled={!selected.length} onClick={() => change({ selected: [] })}>Deselect all</Button>
              </div>
            </div>
            <Form.Control className="mb-3" aria-label="Search sensors" placeholder="Search sensors" value={search} onChange={e => setSearch(e.target.value)} />
            <div className="row row-cols-2 row-cols-md-3 row-cols-lg-4 row-cols-xl-6 g-2 download-modal-sensor-grid">
              {sensors.filter(s => `${s.type} ${s.id}`.toLowerCase().includes(search.toLowerCase())).map(s => <div className="col" key={s.key}>
                <Form.Check id={`sensor-${s.key}`} label={<code>{s.type} {s.id}</code>} checked={selected.includes(s.key)} onChange={e => change({ selected: e.target.checked ? [...selected, s.key] : selected.filter(k => k !== s.key) })} />
              </div>)}
            </div>
          </fieldset>}
        </div>
      </div>
    </Modal.Body>
    <Modal.Footer><Button variant="outline-primary" onClick={onHide}>Close</Button></Modal.Footer>
  </Modal>;
};
export default DownloadModal;
