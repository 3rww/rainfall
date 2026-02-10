import React from 'react';

import { 
  Row, Col, Button, 
  // ButtonToolbar, ButtonGroup, 
  Popover, OverlayTrigger, 
  // ListGroup, Card 
} from 'react-bootstrap';
// import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
// import { faPlay, faPause, faStop, faMap, faHandPointer } from '@fortawesome/free-solid-svg-icons'

import '../../layout.scss';


const popover = (
  <Popover id="popover-basic">
    <Popover.Header as="h3">Provisional Data Disclaimer</Popover.Header>
    <Popover.Body>
      Data shown here are provisional and subject to revision until they have been thoroughly reviewed and received final approval. Current condition data relayed by satellite or other telemetry are automatically screened to not display improbable values until they can be verified. Provisional data may be inaccurate due to instrument malfunctions or physical changes at the measurement site. Subsequent review based on field inspections and measurements may result in significant revisions to the data. Data users are cautioned to consider carefully the provisional nature of the information before using it for decisions that concern personal or public safety or the conduct of business that involves substantial monetary or operational consequences. Information concerning the accuracy and appropriate uses of these data or concerning other hydrologic data may be obtained from the 3RWW.
    </Popover.Body>
  </Popover>
);

export default class LegacyRealtimeRainfallPage extends React.Component {

  render() {

    return (

      <Row>
        <Col>
          <h1 className="data-type-header">Get Real-time Rainfall Data</h1>
          <p>Download real-time, provisional rainfall measurements are available from the rain gauge network and NEXRAD radar. This data is updated every 15 minutes.
            <small className="my-3">
              <OverlayTrigger trigger="click" placement="bottom" overlay={popover}>
                <Button variant="light" size="sm">Provisional Data Disclaimer</Button>
              </OverlayTrigger>
            </small>
          </p>

          {/* <br></br>
          <Card>
            <Card.Header as="h2">Map Provisional Data</Card.Header>
            <ListGroup variant="flush">
              <ListGroup.Item>
                <Row>
                  <Col lg={3}>
                    <h3>Recent Rainfall</h3>
                  </Col>
                  <Col>
                    <p>Click <FontAwesomeIcon icon={faHandPointer} /> on a pixel or gauge on the map <FontAwesomeIcon icon={faMap} /> to see the last 12 hours of rainfall data.</p>
                    <p>For an animated view of rainfall in 15-minute increments, click here:</p>
                    <ButtonToolbar aria-label="Recent Rainfall Animation Controls">
                      <ButtonGroup aria-label="Available Time Loops" className="me-2">
                        <Button variant="light" size="sm">2-Hour Loop</Button>
                        <Button variant="light" size="sm">4-Hour Loop</Button>
                        <Button variant="light" size="sm">6-Hour Loop</Button>
                      </ButtonGroup>
                      <ButtonGroup aria-label="Animation Controls">
                        <Button variant="light" size="sm">
                          <FontAwesomeIcon icon={faPlay} />
                        </Button>
                        <Button variant="light" size="sm">
                          <FontAwesomeIcon icon={faStop} />
                        </Button>
                      </ButtonGroup>
                    </ButtonToolbar>
                  </Col>
                </Row>
              </ListGroup.Item>
              <ListGroup.Item>
                <Row>
                  <Col lg={3}>
                    <h3>Cumulative Rainfall</h3>
                  </Col>
                  <Col>
                    <p>Show cumulative rainfall on the map for</p>
                    <ButtonToolbar aria-label="Recent Rainfall Animation Controls">
                      <ButtonGroup aria-label="Available Time Loops (1)" className="me-2">
                        <Button size="sm" variant="light">last 24 hours</Button>
                        <Button size="sm" variant="light">last 48 hours</Button>
                      </ButtonGroup>
                      <br></br>
                      <ButtonGroup aria-label="Available Time Loops (2)" className="me-2">
                        <Button size="sm" variant="light">last 7 days</Button>
                        <Button size="sm" variant="light">last 30 days</Button>
                      </ButtonGroup>
                      <br></br>
                      <ButtonGroup aria-label="Available Time Loops (3)" className="me-2">
                        <Button size="sm" variant="light">this month to-date</Button>
                        <Button size="sm" variant="light">last month</Button>
                      </ButtonGroup>
                    </ButtonToolbar>
                  </Col>
                </Row>
              </ListGroup.Item>
            </ListGroup>
          </Card>
          <br></br>
          <h2>Download Provisional Data</h2>
          <p>Download provisional rainfall data captured from the gauges or radar pixels over the last 30-60 days:</p> */}
        </Col>
      </Row>

    )

  }
}
