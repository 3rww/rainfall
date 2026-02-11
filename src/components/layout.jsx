import React from 'react';
import { connect } from 'react-redux';
import { Row, Col, Container, TabContent, TabPane, Alert} from 'react-bootstrap';

import ReactMap from './map/map';
import RainfallDownloader from './sidebar/downloader'
import LegacyRealtimeRainfallPage from './sidebar/legacy/legacyRealtime'
import ThinkingOverlay from './thinking/thinkingOverlay'

import { RAINFALL_TYPES, CONTEXT_TYPES, SENSOR_TYPES } from '../store/config'
import { switchContext } from '../store/middleware'

import './layout.css'

/**
* Layout Component. Everything on the page under the Nav: Controls and Map.
*/
class Layout extends React.Component {
  render() {

    return (

      <div className="layout-root">

        <ThinkingOverlay />

        <Row>
          <Col>
            {/* <ProgressBar /> */}
          </Col>
        </Row>

        <Row className="layout-main-row g-0">

        <Col sm={7} className="map-column">
            <ReactMap
              activeTab={this.props.tab}
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
                    <h1 className="data-type-header">Get Historical Rain Gauge Data</h1>
                    <p>Download historic rain gauge data, which has been through a QA/QC process with ALCOSAN and 3RWW, during which any data errors caused by the gauge hardware have been addressed.</p>
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
                    <h1 className="data-type-header">Get Calibrated Radar Rainfall Data</h1>
                    <p>Download calibrated radar rainfall data, which is NEXRAD radar rainfall data adjusted using 3RWW's rain gauge network. Calibration is performed by <a href="https://www.vieuxinc.com/" target="_blank">Vieux Associates</a>.</p>
                    {/* <Alert variant='warning'>
                      <strong>Please note:</strong> We are currently migrating historic calibrated radar rainfall data to a new database; consequently you may find that rainfall data downloaded here for dates prior to July 2020 will be incomplete.
                    </Alert> */}
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
