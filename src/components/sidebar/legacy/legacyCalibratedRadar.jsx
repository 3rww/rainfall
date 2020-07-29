import React from 'react';
import { connect } from 'react-redux';

import { Row, Col, Button, ButtonGroup, Popover, OverlayTrigger } from 'react-bootstrap';



const popover = (
  <Popover id="popover-basic">
    <Popover.Title as="h3">Provisional Data Disclaimer</Popover.Title>
    <Popover.Content>
      Data shown here are provisional and subject to revision until they have been thoroughly reviewed and received final approval. Current condition data relayed by satellite or other telemetry are automatically screened to not display improbable values until they can be verified. Provisional data may be inaccurate due to instrument malfunctions or physical changes at the measurement site. Subsequent review based on field inspections and measurements may result in significant revisions to the data. Data users are cautioned to consider carefully the provisional nature of the information before using it for decisions that concern personal or public safety or the conduct of business that involves substantial monetary or operational consequences. Information concerning the accuracy and appropriate uses of these data or concerning other hydrologic data may be obtained from the 3RWW.
    </Popover.Content>
  </Popover>
);

export default class LegacyRealtimeRainfallPage extends React.Component {

  render() {

    return (

      <Row>
        <Col>
          <h1>Real-time Rainfall (Provisional)</h1>
          <p><small>
              <OverlayTrigger trigger="click" placement="right" overlay={popover}>
                <Button variant="light" size="sm">Disclaimer</Button>
              </OverlayTrigger>
          </small>
          </p>

          <h2>Recent Rainfall</h2>

          <p>Click on a pixel or gauge on the map to see the last 12 hours of rainfall data.</p>

          <p>For an animated view of rainfall (in 15-min. increments) over the last 2-hour, 4-hour or 6-hour tme period, click here: </p>

          <ButtonGroup aria-label="Basic example">
            <Button variant="secondary">2-Hour Loop</Button>
            <Button variant="secondary">4-Hour Loop</Button>
            <Button variant="secondary">6-Hour Loop</Button>
            <Button variant="secondary"></Button>
          </ButtonGroup>

          <h2>Cumulative Rainfall</h2>
          <Button>Show cumulative rainfall on the map over the last 30-60 days</Button>

          <h2>Provisional Data Download</h2>
          <p>To download provisional rainfall data captured from the gauges or radar pixels over the last 30-60 days of rainfall, click here</p>
        </Col>
      </Row>

    )

  }
}

