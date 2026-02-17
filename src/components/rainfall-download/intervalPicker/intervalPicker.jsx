import React, { useCallback } from 'react';
import { Form, Row, Col } from 'react-bootstrap';

import { pickInterval } from '../../../store/features/fetchKwargsSlice';
import { getIntervalOptionsForContext } from '../../../store/config';
import { useAppDispatch } from '../../../store/hooks';

const IntervalPicker = ({ contextType, rainfallDataType }) => {
  const dispatch = useAppDispatch();

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
              defaultChecked={option === '15-minute'}
              inline
              key={`interval-${option}-${index}-${rainfallDataType}`}
              label={option}
              value={option}
              type="radio"
              id={`interval-${option}-${rainfallDataType}`}
              name="intervalRadios"
              onChange={handleSelectInterval}
            />
          ))}
        </Form>
      </Col>
    </Row>
  );
};

export default IntervalPicker;
