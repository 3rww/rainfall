import React, { useEffect } from 'react';
import { Button, ButtonGroup, Form, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBackwardStep, faForwardStep, faPlay, faPause } from '@fortawesome/free-solid-svg-icons';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { activePlaybackResult, changePlaybackMode, seekPlayback, togglePlayback, pausePlayback } from '../../store/features/playbackSlice';

const timestampFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric',
  hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
});
const dateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric'
});

function PlaybackButton({ label, icon, disabled, onClick, id }) {
  return <OverlayTrigger placement="top" overlay={<Tooltip id={id}>{label}</Tooltip>}>
    <span className="playback-button" tabIndex={disabled ? 0 : undefined}>
      <Button variant="outline-primary" aria-label={label} disabled={disabled} onClick={onClick} style={disabled ? { pointerEvents: 'none' } : undefined}>
        <FontAwesomeIcon icon={icon} fixedWidth aria-hidden="true" />
      </Button>
    </span>
  </OverlayTrigger>;
}

export default function PlaybackToolbar() {
  const dispatch = useAppDispatch();
  const p = useAppSelector(state => state.playback);
  const activeResult = useAppSelector(activePlaybackResult);
  useEffect(() => {
    const pause = () => { if (document.hidden) dispatch(pausePlayback()); };
    document.addEventListener('visibilitychange', pause);
    return () => document.removeEventListener('visibilitychange', pause);
  }, [dispatch]);
  if (!activeResult) return null;
  const enabled = p.timeline.length > 1;
  const index = p.frame?.index ?? 0;
  const interval = p.frame?.interval;
  const daily = activeResult.fetchKwargs.rollup.toLowerCase() === 'daily';
  const timestamp = interval ? (daily ? dateFormatter.format(interval.startMs) + ' (Eastern)' : timestampFormatter.format(interval.endMs)) : '';
  return <div className="playback-toolbar container-fluid py-2 d-flex flex-wrap gap-2 align-items-center" aria-label="Rainfall playback">
    <Form.Select size="sm" aria-label="Rainfall map view" value={p.mode} onChange={e => dispatch(changePlaybackMode(e.target.value))} className="playback-mode">
      <option value="total">Query total</option>
      <option value="interval" disabled={!p.available}>Interval</option>
      <option value="cumulative" disabled={!p.available}>Cumulative</option>
    </Form.Select>
    {p.mode !== 'total' ? <>
      <ButtonGroup size="sm" aria-label="Playback controls">
        <PlaybackButton id="playback-previous" label="Previous timestep" icon={faBackwardStep} disabled={!enabled || index === 0} onClick={() => dispatch(seekPlayback(index - 1))} />
        <PlaybackButton id="playback-toggle" label={p.playing ? 'Pause playback' : 'Play playback'} icon={p.playing ? faPause : faPlay} disabled={!enabled || !p.frame} onClick={() => dispatch(togglePlayback())} />
        <PlaybackButton id="playback-next" label="Next timestep" icon={faForwardStep} disabled={!enabled || index === p.timeline.length - 1} onClick={() => dispatch(seekPlayback(index + 1))} />
      </ButtonGroup>
      <div className="playback-timeline d-flex gap-2 align-items-center">
        <Form.Range className="playback-slider" aria-label="Rainfall timestep" aria-valuetext={interval?.label || 'No timestep selected'} min={0} max={Math.max(0, p.timeline.length - 1)} step={1} value={index} disabled={!enabled} onChange={e => dispatch(seekPlayback(Number(e.target.value)))} />
        <span className="small playback-label" title={interval?.label}>
          {interval ? <><time dateTime={new Date(daily ? interval.startMs : interval.endMs).toISOString()}>{timestamp}</time> · {index + 1}/{p.timeline.length}</> : 'Preparing playback…'}
          {p.frame && p.status === 'loading' ? ' · Loading…' : ''}
        </span>
      </div>
    </> : p.message && <span className="small">{p.message}</span>}
  </div>;
}
