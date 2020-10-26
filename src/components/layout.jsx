import React from 'react';
import { connect } from 'react-redux';
import { Row, Col, Container, TabContent, TabPane} from 'react-bootstrap';
import ReactMarkdown from 'react-markdown/with-html'

import ReactMap from './map/map';
import RainfallDownloader from './sidebar/downloader'
import LegacyRealtimeRainfallPage from './sidebar/legacy/legacyRealtime'
import ThinkingOverlay from './thinking/thinkingOverlay'

import { RAINFALL_TYPES, CONTEXT_TYPES } from '../store/config'
import { switchTab } from '../store/actions'

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
          <Col sm={5} className="scrolling-column">
            <Container className="sidebar">
              {/* <TabContainer
                defaultActiveKey={CONTEXT_TYPES.legacyRealtime}
                id="rainfall-data-type-tabs"
                mountOnEnter={true}
                onSelect={this.props.switchTab}
              > */}
                <TabContent>
                  <TabPane active={this.props.tab == CONTEXT_TYPES.legacyRealtime} eventKey={CONTEXT_TYPES.legacyRealtime} title="Real-Time Rainfall">
                    <LegacyRealtimeRainfallPage/>
                    <RainfallDownloader rainfallDataType={RAINFALL_TYPES.realtime} />
                  </TabPane>
                  <TabPane active={this.props.tab == CONTEXT_TYPES.legacyGauge} eventKey={CONTEXT_TYPES.legacyGauge} title="Historical Rain Gauge">
                    <h1>Historical Rain Gauge Data</h1>
                    <p>Select the rain gauges and time span for output. A map of the rain gauge locations is below.</p>
                    <RainfallDownloader rainfallDataType={RAINFALL_TYPES.historic} />
                  </TabPane>
                  <TabPane active={this.props.tab == CONTEXT_TYPES.legacyGarr} eventKey={CONTEXT_TYPES.legacyGarr} title="Calibrated Radar Rainfall">
                    <h1>Calibrated Radar Rainfall</h1>
                    <RainfallDownloader rainfallDataType={RAINFALL_TYPES.historic} />
                  </TabPane>
              </TabContent>
              {/* </TabContainer> */}
            </Container>
          </Col>

          <Col sm={7} className="map-column">
            <ReactMap
              token={this.props.token}
              styleUrl={this.props.styleId}
              latitude={this.props.latitude}
              longitude={this.props.longitude}
              zoom={this.props.zoom}
            />
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
  switchTab
}

export default connect(mapStateToProps, mapDispatchToProps)(Layout);