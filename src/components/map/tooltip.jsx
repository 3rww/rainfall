import React from 'react';
import { ListGroup, Card } from 'react-bootstrap';
import { paddedRound } from '../../store/utils/index';
import './tooltip.css';
import { formatExcelDateTimeInEastern } from '../sidebar/downloadTableUtils';

export const Tooltip = ({ features, playback, frame, readout, burst }) => {
  const visible = features.filter(feature => feature.id !== undefined);
  if (!visible.length) return null;
  const active = Boolean(playback && playback.mode !== 'total');
  const caption = active ? (playback.mode === 'interval' ? 'Interval rainfall' : 'Cumulative rainfall') : 'Total rainfall';
  return <Card><ListGroup variant="flush">
    {visible.map((feature, index) => {
      const reading = active ? readout?.(feature.source, feature.id) : null;
      const value = active ? reading?.value ?? null : feature.properties.total;
      return <ListGroup.Item key={index}>
        <h6 className="tooltip-header">{feature.properties.label}</h6>
        {active && frame && <p className="tooltip-body">{frame.interval.label}</p>}
        {value === null ? <p className="tooltip-body">No rainfall observations available.</p> : typeof value === 'number' ?
          <p className="tooltip-body">{caption}: <strong>{active ? value.toFixed(3) : paddedRound(value, 2)}</strong> inches</p> : null}
        {playback?.mode === 'combined' && feature.source === 'pixel' && <>
          <p className="tooltip-body">Interval rainfall: {reading?.intervalValue == null ? 'No observations available.' : <><strong>{reading.intervalValue.toFixed(3)}</strong> inches</>}</p>
          {burst && frame && burst.index === frame.index && <p className="tooltip-body">
            Added over {burst.count} intervals: <strong>{(burst.amounts.get(String(feature.id)) ?? 0).toFixed(3)}</strong> inches<br />
            {formatExcelDateTimeInEastern(new Date(burst.startMs))} – {formatExcelDateTimeInEastern(new Date(burst.endMs))}
          </p>}
        </>}
      </ListGroup.Item>;
    })}
  </ListGroup></Card>;
};
