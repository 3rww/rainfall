import React from 'react';
import { connect } from 'react-redux';
import { Row, Col, Container, TabContent, TabPane, Alert} from 'react-bootstrap';

import ReactMap from './map/map';
import RainfallDownloader from './sidebar/downloader'
import LegacyRealtimeRainfallPage from './sidebar/legacy/legacyRealtime'
import ThinkingOverlay from './thinking/thinkingOverlay'

import { RAINFALL_TYPES, CONTEXT_TYPES, SENSOR_TYPES } from '../store/config'
import { switchContext } from '../store/middleware'

import './layout.scss'

/**
* Layout Component. Everything on the page under the Nav: Controls and Map.
*/
class Layout extends React.Component {
  render() {

    return (

      <div className="fill no-gutters">

        <ThinkingOverlay />

        <Row>
          <Col>
            {/* <ProgressBar /> */}
          </Col>
        </Row>

        <Row className="fill no-gutters">

        <Col sm={7} className="map-column">
            <ReactMap
              token={this.props.token}
              styleUrl={this.props.styleId}
              latitude={this.props.latitude}
              longitude={this.props.longitude}
              zoom={this.props.zoom}
            />
          </Col>

          <Col sm={5} className="sidebar-column">
            <Container className="sidebar mt-3">
              {/* <TabContainer
                defaultActiveKey={CONTEXT_TYPES.legacyRealtime}
                id="rainfall-data-type-tabs"
                mountOnEnter={true}
                onSelect={this.props.switchContext}
              > */}
                <TabContent>
                  <TabPane
                    active={this.props.tab === CONTEXT_TYPES.legacyRealtime} 
                    eventKey={CONTEXT_TYPES.legacyRealtime} 
                    title="Real-Time Rainfall"
                  >
                    <LegacyRealtimeRainfallPage/>
                    <RainfallDownloader
                      contextType={CONTEXT_TYPES.legacyRealtime} 
                      rainfallDataType={RAINFALL_TYPES.realtime}
                      rainfallSensorTypes={[SENSOR_TYPES.gauge, SENSOR_TYPES.pixel]}
                    />
                  </TabPane>
                  <TabPane 
                    active={this.props.tab === CONTEXT_TYPES.legacyGauge} 
                    eventKey={CONTEXT_TYPES.legacyGauge} 
                    title="Historical Rain Gauge"
                  >
                    <h1 className="data-type-header">Historical Rain Gauge Data</h1>
                    <p>Historic rain gauge data has been through a QA/QC process by ALCOSAN and 3RWW, where data errors caused by the hardware have been addressed.</p>
                    <RainfallDownloader 
                      contextType={CONTEXT_TYPES.legacyGauge} 
                      rainfallDataType={RAINFALL_TYPES.historic}
                      rainfallSensorTypes={[SENSOR_TYPES.gauge]}
                    />
                  </TabPane>
                  <TabPane 
                    active={this.props.tab === CONTEXT_TYPES.legacyGarr} 
                    eventKey={CONTEXT_TYPES.legacyGarr}
                    title="Calibrated Radar Rainfall"
                  >
                    <h1 className="data-type-header">Calibrated Radar Rainfall</h1>
                    <p>Calibrated radar rainfall data is NEXRAD radar rainfall data adjusted using our rain gauge network. Calibration is performed by <a href="https://www.vieuxinc.com/" target="_blank">Vieux Associates</a>.</p>
                    <Alert variant='warning'>
                      <strong>Please note:</strong> We are currently migrating historic calibrated radar rainfall data to a new database; consequently rainfall data downloaded here will be incomplete.
                      </Alert>
                    <RainfallDownloader 
                      contextType={CONTEXT_TYPES.legacyGarr} 
                      rainfallDataType={RAINFALL_TYPES.historic}
                      rainfallSensorTypes={[SENSOR_TYPES.pixel]}
                    />
                  </TabPane>
              </TabContent>
              {/* </TabContainer> */}
            </Container>
          </Col>


        </Row>
      </div>
      // </Container>
    )
  }
}

function mapStateToProps(state) {
  return { 
    ...state.initMap, 
    tab: state.progress.tab 
  }
}

const mapDispatchToProps = {
  switchContext
}

export default connect(mapStateToProps, mapDispatchToProps)(Layout);