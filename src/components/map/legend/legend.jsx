import React, { useCallback } from 'react';
import { Table, Row, Col, Form } from 'react-bootstrap';
import { get } from 'lodash-es';
import chroma from 'chroma-js';
import { createSelector } from '@reduxjs/toolkit';

import { LEGEND_BREAKS } from '../../../store/config';
import { applyColorStretch } from '../../../store/features/mapStyleSlice';
import { buildRainfallColorStyleExp } from '../../../store/utils/mb';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';

import './legend.css';

const DEFAULT_LEGEND_BINS = buildRainfallColorStyleExp('total', LEGEND_BREAKS.breaks_050).legendContent;
const EMPTY_ARRAY = [];

const selectLegendBins = createSelector(
  [(state) => get(state, ['mapLegend', 'content'], EMPTY_ARRAY)],
  (contentBins) => {
    const sourceBins = Array.isArray(contentBins) && contentBins.length > 0
      ? contentBins
      : DEFAULT_LEGEND_BINS;

    return sourceBins
      .filter((bin) => Array.isArray(bin) && bin.length >= 2 && chroma.valid(bin[1]))
      .map((bin) => {
        const fontColor = chroma(bin[1]).luminance() < 0.4 ? '#fff' : '#000';
        return [bin[0], bin[1], fontColor];
      });
  }
);

const MapLegend = () => {
  const dispatch = useAppDispatch();

  const bins = useAppSelector(selectLegendBins);

  const handleSelectLegend = useCallback((event) => {
    dispatch(applyColorStretch({
      breaks: LEGEND_BREAKS[event.currentTarget.value]
    }));
  }, [dispatch]);

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
        <span className="form-check-label">Total Rainfall</span>
      </Col>
      <Col sm={2}>
        <Form>
          <Form.Check defaultChecked size="sm" value="breaks_005" label="0.5 in." name="legendRadios" type="radio" id="legend-radio-1" onChange={handleSelectLegend} />
          <Form.Check size="sm" value="breaks_050" label="5 in." name="legendRadios" type="radio" id="legend-radio-2" onChange={handleSelectLegend} />
          <Form.Check size="sm" value="breaks_100" label="10 in." name="legendRadios" type="radio" id="legend-radio-3" onChange={handleSelectLegend} />
        </Form>
      </Col>
    </Row>
  );
};

export default MapLegend;
