import React from 'react';
import { ListGroup, Card } from 'react-bootstrap';
import { paddedRound } from '../../store/utils/index';
import './tooltip.css';

export const Tooltip = ({ features, playback }) => {
  const visible = features.filter(feature => feature.id !== undefined);
  if (!visible.length) return null;
  const active = Boolean(playback && playback.mode !== 'total');
  const caption = active ? (playback.mode === 'cumulative' ? 'Cumulative rainfall' : 'Interval rainfall') : 'Total rainfall';
  return <Card><ListGroup variant="flush">
    {visible.map((feature, index) => {
      const reading = active ? playback.frame?.values.find(value => value.source === feature.source && value.id === String(feature.id)) : null;
      const value = active ? reading?.value ?? null : feature.properties.total;
      return <ListGroup.Item key={index}>
        <h6 className="tooltip-header">{feature.properties.label}</h6>
        {active && playback.frame && <p className="tooltip-body">{playback.frame.interval.label}</p>}
        {value === null ? <p className="tooltip-body">No rainfall observations available.</p> : typeof value === 'number' ?
          <p className="tooltip-body">{caption}: <strong>{active ? value.toFixed(3) : paddedRound(value, 2)}</strong> inches</p> : null}
      </ListGroup.Item>;
    })}
  </ListGroup></Card>;
};
