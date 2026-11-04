import { shallowEqual } from 'react-redux';
import React, { useCallback, useMemo } from 'react';
import { Table, Row, Col, Form } from 'react-bootstrap';
import chroma from 'chroma-js';

import { LEGEND_BREAKS, LEGEND_SCALE_OPTIONS } from '../../store/config';
import { applyColorStretch } from '../../store/features/mapStyleSlice';
import { buildRainfallColorStyleExp } from '../../store/utils/mb';
import { useAppDispatch, useAppSelector } from '../../store/hooks';

import './legend.css';
import { selectPlaybackScale, playbackScale } from '../../store/features/playbackSlice';

const MapLegend = () => {
  const dispatch = useAppDispatch();

  const playback = useAppSelector(state => ({ mode: state.playback.mode, scales: state.playback.scales }), shallowEqual);
  const scale = playbackScale(playback);
  const bins = useMemo(() => buildRainfallColorStyleExp('total', LEGEND_BREAKS[scale]).legendContent
    .map(bin => [bin[0], bin[1], chroma(bin[1]).luminance() < 0.4 ? '#fff' : '#000']), [scale]);

  const handleSelectLegend = useCallback((event) => {
    dispatch(selectPlaybackScale(event.currentTarget.value));
    if (playback.mode === 'total') dispatch(applyColorStretch({ breaks: LEGEND_BREAKS[event.currentTarget.value] }));
  }, [dispatch, playback.mode]);

  return (
    <Row className="my-2">
      <Col sm={10}>
        <Table size="sm">
          <tbody>
            <tr>
              {bins.map((bin, binIndex) => (
                <td
                  key={binIndex}
                  className="text-center legend-label"
                  style={{ backgroundColor: `${bin[1]}` }}
                >
                  <span style={{ color: `${bin[2]}` }}>
                    {bin[0]}
                  </span>
                </td>
              ))}
            </tr>
          </tbody>
        </Table>
        <span className="form-check-label">{playback.mode === 'total' ? 'Total Rainfall' : playback.mode === 'interval' ? 'Interval Rainfall' : 'Cumulative Rainfall'} (inches)</span>
      </Col>
      <Col sm={2}>
        <Form>
          {LEGEND_SCALE_OPTIONS.map((option, index) => (
            <Form.Check
              key={option.value}
              size="sm"
              checked={scale === option.value}
              value={option.value}
              label={option.label}
              name="legendRadios"
              type="radio"
              id={`legend-radio-${index + 1}`}
              onChange={handleSelectLegend}
            />
          ))}
        </Form>
      </Col>
    </Row>
  );
};

export default MapLegend;
