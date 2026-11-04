import { shallowEqual } from 'react-redux';
import React, { useCallback, useMemo } from 'react';
import Card from 'react-bootstrap/Card';
import Dropdown from 'react-bootstrap/Dropdown';
import DropdownButton from 'react-bootstrap/DropdownButton';
import chroma from 'chroma-js';

import { LEGEND_BREAKS, LEGEND_SCALE_OPTIONS } from '../../store/config';
import { applyColorStretch } from '../../store/features/mapStyleSlice';
import { buildRainfallColorStyleExp } from '../../store/utils/mb';
import { useAppDispatch, useAppSelector } from '../../store/hooks';

import './legend.css';
import { selectPlaybackScale, playbackScale } from '../../store/features/playbackSlice';

const MapLegendVertical = () => {
  const dispatch = useAppDispatch();

  const playback = useAppSelector(state => ({ mode: state.playback.mode, scales: state.playback.scales }), shallowEqual);
  const scale = playbackScale(playback);
  const bins = useMemo(
    () => buildRainfallColorStyleExp('total', LEGEND_BREAKS[scale])
    .legendContent
    .map(bin => [bin[0], bin[1], chroma(bin[1]).luminance() < 0.4 ? '#fff' : '#000'])
    .reverse(), [scale]
  );

  const handleSelectLegend = useCallback((value) => {
    dispatch(selectPlaybackScale(value));
    if (playback.mode === 'total') dispatch(applyColorStretch({ breaks: LEGEND_BREAKS[value] }));
  }, [dispatch, playback.mode]);

  const currentScaleLabel = LEGEND_SCALE_OPTIONS.find(opt => opt.value === scale)?.label ?? 'Select scale';

  return (
    <Card as="section" className="map-legend-card shadow-sm" aria-labelledby="map-legend-title">
      <Card.Header as="h2" id="map-legend-title" className="map-legend-title text-center mb-0 p-2">
        {playback.mode === 'total' ? 'Total Rainfall' : playback.mode === 'interval' ? 'Interval Rainfall' : 'Cumulative Rainfall'}
        <span className="d-block fw-normal mt-1">(inches)</span>
      </Card.Header>

      <Card.Body className="map-legend-body p-2">
        <div className="legend-vert">
          {bins.map((bin, binIndex) => (
            <div
              key={binIndex}
              className="text-center legend-label"
              style={{ backgroundColor: `${bin[1]}` }}
            >
              <span style={{ color: `${bin[2]}` }}>
                {bin[0]}
              </span>
            </div>
          ))}
        </div>
      </Card.Body>

      <Card.Footer className="p-2">
        <DropdownButton
          className="legend-scale-dropdown"
          variant="secondary"
          size="sm"
          title={currentScaleLabel}
          id="legend-scale-dropdown-button"
          aria-label={`Rainfall color scale: ${currentScaleLabel}`}
        >
          {LEGEND_SCALE_OPTIONS.map((opt, idx) => (
            <Dropdown.Item
              key={opt.value}
              id={`legend-radio-${idx + 1}`}
              active={scale === opt.value}
              onClick={() => handleSelectLegend(opt.value)}
            >
              <span className="small">{opt.label}</span>
            </Dropdown.Item>
          ))}
        </DropdownButton>
      </Card.Footer>
    </Card>
  );
};

export default MapLegendVertical;
