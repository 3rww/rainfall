import React, { useEffect } from 'react';
import { Button, ButtonGroup, Form, OverlayTrigger, Tooltip } from 'react-bootstrap';
import Dropdown from 'react-bootstrap/Dropdown';
import DropdownButton from 'react-bootstrap/DropdownButton';
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
      <Button variant="outline-primary" size="sm" aria-label={label} disabled={disabled} onClick={onClick} style={disabled ? { pointerEvents: 'none' } : undefined}>
        <FontAwesomeIcon icon={icon} fixedWidth aria-hidden="true" />
      </Button>
    </span>
  </OverlayTrigger>;
}

export default function PlaybackToolbar() {
  const dispatch = useAppDispatch();
  const playbackMode = useAppSelector(state => state.playback);
  const activeResult = useAppSelector(activePlaybackResult);
  useEffect(() => {
    const pause = () => { if (document.hidden) dispatch(pausePlayback()); };
    document.addEventListener('visibilitychange', pause);
    return () => document.removeEventListener('visibilitychange', pause);
  }, [dispatch]);
  if (!activeResult) return null;
  const enabled = playbackMode.timeline.length > 1;
  const index = playbackMode.target;
  const interval = playbackMode.frame?.interval;
  const daily = activeResult.fetchKwargs.rollup.toLowerCase() === 'daily';
  const timestamp = interval ? (daily ? dateFormatter.format(interval.startMs) + ' (Eastern)' : timestampFormatter.format(interval.endMs)) : '';
  const scaleOptions = [
    { value: 'total', label: 'Total Rainfall' },
    { value: 'interval', label: 'Rainfall by Interval' },
    { value: 'cumulative', label: 'Cumulative Rainfall' },
  ];
  const currentScaleLabel = scaleOptions.find(opt => opt.value === playbackMode.mode)?.label ?? 'Rainfall map view';
  console.log(playbackMode.mode, currentScaleLabel);
  return <div className=" container-fluid py-2" aria-label="Rainfall playback">
    <div className="row g-2">
      <div className="col-auto">
        <DropdownButton
          size="sm"
          variant="outline-primary"
          title={currentScaleLabel}
          aria-label="Rainfall map view"
          className="playback-mode"
        >
          {scaleOptions.map((opt, idx) => (
            <Dropdown.Item
              key={opt.value}
              id={`legend-radio-${idx + 1}`}
              active={playbackMode.mode === opt.value}
              onClick={() => dispatch(changePlaybackMode(opt.value))}
            >
              <span className="small">{opt.label}</span>
            </Dropdown.Item>
          ))}          
        </DropdownButton>
      </div>
      {playbackMode.mode !== 'total' ? <>
        <div className="col-auto">
          <ButtonGroup size="sm" aria-label="Playback controls">
            <PlaybackButton id="playback-previous" label="Previous timestep" icon={faBackwardStep} disabled={!enabled || index === 0} onClick={() => dispatch(seekPlayback(index - 1))} />
            <PlaybackButton id="playback-toggle" label={playbackMode.playing ? 'Pause playback' : 'Play playback'} icon={playbackMode.playing ? faPause : faPlay} disabled={!enabled || !playbackMode.frame} onClick={() => dispatch(togglePlayback())} />
            <PlaybackButton id="playback-next" label="Next timestep" icon={faForwardStep} disabled={!enabled || index === playbackMode.timeline.length - 1} onClick={() => dispatch(seekPlayback(index + 1))} />
          </ButtonGroup>
        </div>
        <div className="col-auto playback-timeline">
          <Form.Range className="playback-slider" aria-label="Rainfall timestep" aria-valuetext={playbackMode.timeline[index]?.label || 'No timestep selected'} min={0} max={Math.max(0, playbackMode.timeline.length - 1)} step={1} value={index} disabled={!enabled} onPointerDown={() => dispatch(pausePlayback())} onChange={e => dispatch(seekPlayback(Number(e.target.value)))} />
        </div>        
        <div className="col-auto ">
          <span className="small text-muted text-center" title={interval?.label}>
            {interval ? <><time dateTime={new Date(daily ? interval.startMs : interval.endMs).toISOString()}>{timestamp}</time> · {playbackMode.frame.index + 1}/{playbackMode.timeline.length}</> : 'Preparing playback…'}
            {/* {p.frame && p.status === 'loading' ? ' · Loading…' : ''} */}
          </span>
        </div>
      </> : playbackMode.message && <span className="col small">{playbackMode.message}</span>}
    </div>
  </div>;
}
