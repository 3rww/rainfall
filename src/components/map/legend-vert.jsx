import React, { useCallback, useMemo } from 'react';
import Dropdown from 'react-bootstrap/Dropdown';
import DropdownButton from 'react-bootstrap/DropdownButton';
import chroma from 'chroma-js';

import { LEGEND_BREAKS } from '../../store/config';
import { applyColorStretch } from '../../store/features/mapStyleSlice';
import { buildRainfallColorStyleExp } from '../../store/utils/mb';
import { useAppDispatch, useAppSelector } from '../../store/hooks';

import './legend.css';
import { selectPlaybackScale } from '../../store/features/playbackSlice';

const MapLegendVertical = () => {
  const dispatch = useAppDispatch();

  const playback = useAppSelector(state => state.playback);
  const scale = playback.scales[playback.mode];
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

  const scaleOptions = [
    { value: 'breaks_005', label: '0.5 in.' },
    { value: 'breaks_050', label: '5 in.' },
    { value: 'breaks_100', label: '10 in.' },
  ];

  const currentScaleLabel = scaleOptions.find(opt => opt.value === scale)?.label ?? 'Select scale';

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <span className="form-check-label lh-1 text-left m-1">
        {playback.mode === 'total' ? 'Total Rainfall' : playback.mode === 'interval' ? 'Interval Rainfall' : 'Cumulative Rainfall'} (inches)
      </span>

      <div className="legend-vert" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly' }}>
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

      <DropdownButton
        variant="secondary"
        size="sm"
        title={currentScaleLabel}
        id="legend-scale-dropdown-button"
      >
        {scaleOptions.map((opt, idx) => (
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
    </div>
  );
};

export default MapLegendVertical;
