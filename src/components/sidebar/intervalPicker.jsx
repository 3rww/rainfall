import React, { useCallback } from 'react';
import { Form, Row, Col } from 'react-bootstrap';

import { pickInterval } from '../../store/features/fetchKwargsSlice';
import { getIntervalOptionsForContext } from '../../store/config';
import { useAppDispatch, useAppSelector } from '../../store/hooks';

import { selectFetchKwargs } from '../../store/selectors';

const IntervalPicker = ({ contextType, rainfallDataType }) => {
  const dispatch = useAppDispatch();
  const rollup = useAppSelector((state) => selectFetchKwargs(state, contextType).rollup);

  const handleSelectInterval = useCallback((event) => {
    dispatch(pickInterval({
      rollup: event.currentTarget.value,
      contextType
    }));
  }, [contextType, dispatch]);

  const intervalOptions = getIntervalOptionsForContext(contextType);

  return (
    <Row className="g-0">
      <Col lg={3}>
        <strong>Interval</strong>
      </Col>
      <Col lg={9}>
        <Form>
          {intervalOptions.map((option, index) => (
            <Form.Check
              checked={option === rollup}
              inline
              key={`interval-${option}-${index}-${rainfallDataType}`}
              label={option}
              value={option}
              type="radio"
              id={`interval-${contextType}-${option}-${rainfallDataType}`}
              name={`intervalRadios-${contextType}`}
              onChange={handleSelectInterval}
            />
          ))}
        </Form>
      </Col>
    </Row>
  );
};

export default IntervalPicker;
