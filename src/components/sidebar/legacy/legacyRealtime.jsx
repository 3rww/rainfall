import React from 'react';
import {
  Row,
  Col,
  Button,
  Popover,
  OverlayTrigger
} from 'react-bootstrap';

import '../../layout.css';

const popover = (
  <Popover id="popover-basic">
    <Popover.Header as="h3">Provisional Data Disclaimer</Popover.Header>
    <Popover.Body>
      Data shown here are provisional and subject to revision until they have been thoroughly reviewed and received final approval. Current condition data relayed by satellite or other telemetry are automatically screened to not display improbable values until they can be verified. Provisional data may be inaccurate due to instrument malfunctions or physical changes at the measurement site. Subsequent review based on field inspections and measurements may result in significant revisions to the data. Data users are cautioned to consider carefully the provisional nature of the information before using it for decisions that concern personal or public safety or the conduct of business that involves substantial monetary or operational consequences. Information concerning the accuracy and appropriate uses of these data or concerning other hydrologic data may be obtained from the 3RWW.
    </Popover.Body>
  </Popover>
);

const LegacyRealtimeRainfallPage = () => (
  <Row>
    <Col>
      <h1 className="data-type-header">Get Real-time Rainfall Data</h1>
      <p>
        Download real-time, provisional rainfall measurements are available from the rain gauge network and NEXRAD radar. This data is updated every 15 minutes.
        <small className="my-3">
          <OverlayTrigger trigger="click" placement="bottom" overlay={popover}>
            <Button variant="light" size="sm">Provisional Data Disclaimer</Button>
          </OverlayTrigger>
        </small>
      </p>
    </Col>
  </Row>
);

export default LegacyRealtimeRainfallPage;
