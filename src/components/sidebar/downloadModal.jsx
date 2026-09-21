import React, { useMemo, useState, lazy, Suspense } from 'react';
import { Modal, Button, Form, Alert } from 'react-bootstrap';
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
      <div className="download-modal-download-row d-flex gap-3 align-items-start">
        <p>Download as:</p>
        {['csv', 'swmm'].map(format => {
          const op = ui.operations?.[format];
          return <div key={format}>
            <Button size="sm" variant="outline-primary" disabled={!available || !records || op?.status === 'pending'} onClick={() => dispatch(exportRequested({ ...arg, format }))}>{format === 'csv' ? 'CSV' : 'SWMM (.inp)'}</Button>
            {op?.status === 'pending' && <div role="status"><small>{format.toUpperCase()}: {op.progress?.total ? `${Math.min(100, Math.round(100 * op.progress.processed / op.progress.total))}%` : 'Preparing…'}</small> <Button size="sm" variant="link" onClick={() => dispatch(operationCanceled({ ...arg, format }))}>Cancel {format.toUpperCase()}</Button></div>}
            {op?.status === 'ready' && <Button size="sm" onClick={() => dispatch(saveRequested({ ...arg, format }))}>Ready to save {format.toUpperCase()}</Button>}
            {op?.status === 'failed' && <p role="alert">{op.error}</p>}
          </div>;
        })}
      </div>
      <p className="small download-modal-chart-meta"><em>{records} total records across {sensors.length} sensors</em></p>
      <div className="border-top mt-3 py-3">
        <Form.Check checked={ui.mode !== 'perSensor'} id="download-average-only-toggle" label="Average by Type" type="switch" onChange={e => change({ mode: e.target.checked ? 'averageByType' : 'perSensor' })} />
        {ui.mode === 'perSensor' && <fieldset className="my-2"><legend className="fs-6">Individual sensors ({selected.length}/10)</legend>
          <Form.Control aria-label="Search sensors" placeholder="Search sensors" value={search} onChange={e => setSearch(e.target.value)} />
          <div style={{ maxHeight: 140, overflowY: 'auto' }}>{sensors.filter(s => `${s.type} ${s.id}`.toLowerCase().includes(search.toLowerCase())).map(s => <Form.Check key={s.key} id={`sensor-${s.key}`} label={`${s.type} ${s.id}`} checked={selected.includes(s.key)} disabled={!selected.includes(s.key) && selected.length >= 10} onChange={e => change({ selected: e.target.checked ? [...selected, s.key] : selected.filter(k => k !== s.key) })} />)}</div>
        </fieldset>}
        <div className="d-flex flex-wrap gap-2 my-3 align-items-end">
          <Form.Label>Chart start date (Eastern)<Form.Control aria-label="Chart start date" type="date" value={ui.range?.start || ''} max={ui.range?.end || undefined} onChange={e => change({ range: { ...ui.range, start: e.target.value } })} /></Form.Label>
          <Form.Label>Chart end date (Eastern)<Form.Control aria-label="Chart end date" type="date" value={ui.range?.end || ''} min={ui.range?.start || undefined} onChange={e => change({ range: { ...ui.range, end: e.target.value } })} /></Form.Label>
          <Button variant="link" onClick={() => change({ range: {} })}>Reset chart range</Button>
        </div>
        <p className="small">{ui.preview ? `${ui.preview.interval[0].toUpperCase()}${ui.preview.interval.slice(1)} preview; downloads contain ${kwargs.rollup.toLowerCase()} observations.` : 'Downloads contain the original observations.'}</p>
        {previewPending && <p role="status">Preparing chart…</p>}
        {ui.operations?.preview?.status === 'failed' && <Alert variant="danger">{ui.operations.preview.error}</Alert>}
        {!previewPending && ui.preview && <Suspense fallback={<p>Loading chart…</p>}><DownloadLineChart rows={ui.preview.rows} series={ui.preview.series} /></Suspense>}
      </div>
    </Modal.Body>
    <Modal.Footer><Button variant="outline-primary" onClick={onHide}>Close</Button></Modal.Footer>
  </Modal>;
};
export default DownloadModal;
