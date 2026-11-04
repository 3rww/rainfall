import React, { lazy, Suspense } from 'react';
import { Button, ButtonGroup, Form, OverlayTrigger, Tooltip } from 'react-bootstrap';
import Dropdown from 'react-bootstrap/Dropdown';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBackwardStep, faForwardStep, faPlay, faPause, faRepeat } from '@fortawesome/free-solid-svg-icons';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { activePlaybackResult, changePlaybackMode, seekPlayback, stepPlayback, togglePlayback, pausePlayback, selectPlaybackSpeed, togglePlaybackRepeat, PLAYBACK_SPEEDS, playbackScaleMode } from '../../store/features/playbackSlice';
import { burstThreshold } from './intervalBursts';
const PlaybackSparkline = lazy(() => import('./playbackSparkline'));

const timestampFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric',
  hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
});
const dateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric'
});

function PlaybackButton({ label, icon, disabled, onClick, id, pressed }) {
  return <OverlayTrigger placement="top" overlay={<Tooltip id={id}>{label}</Tooltip>}>
    <span className="playback-button" tabIndex={disabled ? 0 : undefined}>
      <Button variant="outline-primary" size="sm" aria-label={label} aria-pressed={pressed} active={pressed} disabled={disabled} onClick={onClick} style={disabled ? { pointerEvents: 'none' } : undefined}>
        <FontAwesomeIcon icon={icon} fixedWidth aria-hidden="true" />
      </Button>
    </span>
  </OverlayTrigger>;
}

export default function PlaybackToolbar() {
  const dispatch = useAppDispatch();
  const playbackMode = useAppSelector(state => state.playback);
  const activeResult = useAppSelector(activePlaybackResult);
  if (!activeResult) return null;
  const enabled = playbackMode.timeline.length > 1;
  const index = playbackMode.target;
  const interval = playbackMode.interval;
  const daily = activeResult.fetchKwargs.rollup.toLowerCase() === 'daily';
  const timestamp = interval ? (daily ? dateFormatter.format(interval.startMs) + ' (Eastern)' : timestampFormatter.format(interval.endMs)) : '';
  const scaleOptions = [
    { value: 'total', label: 'Total Rainfall' },
    { value: 'interval', label: 'Rainfall by Interval' },
    { value: 'cumulative', label: 'Cumulative Rainfall' },
    ...(activeResult.resultHandles?.pixel ? [{ value: 'combined', label: 'Cumulative + Rain Drops' }] : []),
  ];
  const currentScaleLabel = scaleOptions.find(opt => opt.value === playbackMode.mode)?.label ?? 'Rainfall map view';
  return <div className="playback-toolbar container-fluid py-2" aria-label="Rainfall playback">
    <div className="row g-2">
      <div className="col-auto">
        <Dropdown className="playback-mode">
          <Dropdown.Toggle size="sm" variant="outline-primary" aria-label="Rainfall map view">
            {currentScaleLabel}
          </Dropdown.Toggle>
          <Dropdown.Menu>
          {scaleOptions.map((opt, idx) => (
            <Dropdown.Item
              as="button"
              type="button"
              key={opt.value}
              id={`playback-mode-${idx + 1}`}
              active={playbackMode.mode === opt.value}
              disabled={opt.value !== 'total' && !playbackMode.available}
              onClick={() => dispatch(changePlaybackMode(opt.value))}
            >
              <span className="small">{opt.label}</span>
            </Dropdown.Item>
          ))}          
          </Dropdown.Menu>
        </Dropdown>
      </div>
      {playbackMode.mode !== 'total' ? <>
        <div className="col-auto">
          <ButtonGroup size="sm" aria-label="Playback controls">
            <PlaybackButton id="playback-previous" label="Previous timestep" icon={faBackwardStep} disabled={!enabled || playbackMode.appliedIndex === null || (!playbackMode.playing && index === 0)} onClick={() => dispatch(stepPlayback(-1))} />
            <PlaybackButton id="playback-toggle" label={playbackMode.playing ? 'Pause playback' : 'Play playback'} icon={playbackMode.playing ? faPause : faPlay} disabled={!enabled || playbackMode.appliedIndex === null} onClick={() => dispatch(togglePlayback())} />
            <PlaybackButton id="playback-next" label="Next timestep" icon={faForwardStep} disabled={!enabled || playbackMode.appliedIndex === null || (!playbackMode.playing && index === playbackMode.timeline.length - 1)} onClick={() => dispatch(stepPlayback(1))} />
            <PlaybackButton id="playback-repeat" label="Repeat playback" icon={faRepeat} pressed={playbackMode.repeat} disabled={!enabled} onClick={() => dispatch(togglePlaybackRepeat())} />
          </ButtonGroup>
        </div>
        <div className="col-auto">
          <Dropdown className="playback-speed">
            <Dropdown.Toggle size="sm" variant="outline-primary" aria-label="Playback speed" disabled={!enabled}>
              {playbackMode.speed}×
            </Dropdown.Toggle>
            <Dropdown.Menu>
              {PLAYBACK_SPEEDS.map(speed => <Dropdown.Item as="button" type="button" key={speed} active={playbackMode.speed === speed} onClick={() => dispatch(selectPlaybackSpeed(speed))}>
                <span className="small">{speed}×</span>
              </Dropdown.Item>)}
            </Dropdown.Menu>
          </Dropdown>
        </div>
        <div className="col-auto ms-auto text-end">
          <span className="playback-label small text-muted" title={interval?.label}>
            {interval ? <><time dateTime={new Date(daily ? interval.startMs : interval.endMs).toISOString()}>{timestamp}</time> · {playbackMode.appliedIndex + 1}/{playbackMode.timeline.length}</> : 'Preparing playback…'}
            {/* {p.frame && p.status === 'loading' ? ' · Loading…' : ''} */}
          </span>
        </div>
      </> : playbackMode.message && <span className="col small">{playbackMode.message}</span>}
    </div>
    {/* {playbackMode.mode === 'combined' && <div className="burst-key small text-muted mt-1">
       <span className="burst-key-ring" aria-hidden="true" />
      <span>Full-size ring: {Number(burstThreshold(playbackMode).toPrecision(3))} in. or more.
        {' '}{playbackMode.playing ? 'Rainfall added per displayed step; may combine intervals.' : 'Rings show rainfall in the selected interval.'}</span>
    </div>} */}
    {playbackMode.mode !== 'total' && <div className="row g-2">
      <div className="col playback-timeline">
        <Suspense fallback={null}>
          <PlaybackSparkline values={playbackMode.summary[playbackScaleMode(playbackMode.mode)]} mode={playbackScaleMode(playbackMode.mode)} />
        </Suspense>
        <Form.Range className="playback-slider" aria-label="Rainfall timestep" aria-valuetext={playbackMode.timeline[index]?.label || 'No timestep selected'} min={0} max={Math.max(0, playbackMode.timeline.length - 1)} step={1} value={index} disabled={!enabled} onPointerDown={() => dispatch(pausePlayback())} onChange={e => dispatch(seekPlayback(Number(e.target.value)))} />
      </div>
    </div>}
  </div>;
}
