import React, { Component } from 'react';
import { connect } from 'react-redux';
import { Navbar, Nav, Button, Modal, Col, Row } from 'react-bootstrap';
import ReactMarkdown from 'react-markdown/with-html'

// icons
// import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
// import { faSpinner, faCloudRain } from '@fortawesome/free-solid-svg-icons'

// import {legend} from '../data/legend'

import { CONTEXT_TYPES, ROOT } from '../../store/config'

import { switchContext } from '../../store/middleware'

import './navigation.scss';

class Navigation extends Component {

  constructor(props, context) {
    super(props, context);

    this.handleShow = this.handleShow.bind(this);
    this.handleClose = this.handleClose.bind(this);

    this.state = {
      show: true,
      showWhich: "AboutButton",
      content: {
        AboutButton: {
          title: (
            <Row>
              <Col lg={9}>
                <h1>Make It Rain <small><em>beta</em></small></h1>
                <h2><small>Hyper-local rainfall data for Allegheny County</small></h2>
              </Col>
              <Col>
                <small>A project by </small>
                <br></br><img className="brand-logo" src={`${ROOT}static/assets/3rww_logo_full_inverse_transparent_blue.png`} placeholder="3 River Wet Weather" alt="3RWW Logo" />
              </Col>
            </Row>
          ),
          content: `
Have you ever wondered how rainfall is actually measured? Technical instruments, called rain gauges, are designed to collect and accurately measure rainfall during wet weather events. However, a rain gauge can only provide a specific rainfall measurement for the limited geographic area where the gauge is located.

On the flip side, radar systems, often used in weather reports, do not measure rainfall directly, but rather they detect the intensity of microwave energy reflected by raindrops, called reflectivity. Through the use of a mathematical formula, the reflectivity of the raindrops can be converted by the radar system into rainfall estimates for a particular defined area.

Neither measurement technique is perfect, but when the two are combined—when radar estimates are calibrated with actual rain gauge data—a highly accurate and valuable source of rainfall data can be calculated over large geographic areas.

Because engineers and planners addressing the wet weather issue need this level of accuracy, 3 Rivers Wet Weather created the calibrated radar rainfall system in 2001. Communities throughout Allegheny County use this data—provided in both real-time and historical formats—to design more cost-effective solutions to reduce or eliminate sewage overflows and improve stormwater management.

The NEXRAD radar (located in Moon Township) data is calibrated with the rain gauge measurements collected during the same time period and rain event for every square kilometer in Allegheny County. The resulting rainfall data is equivalent in accuracy to having 2,276 rain gauges placed across the County.

---

## Available Datasets

Currently, this site offers rainfall data in three buckets:

* Real-time Rainfall data: provisional rainfall data for rain gauges and radar pixels
* Historical Rain Gauge data: QA/QC'd rain gauge data, usually available within 30-60 days
* Calibrated Radar Rainfall data: QA/QC'd, gauge-adjusted radar rainfall observations, typically available within 30-60 days

### Real-time Rainfall Data

Provisional data from 3RWW's 33 rain gauges is collected and updated every 15 minutes to provide accurate, quality rainfall information as it is occurring. This includes both gauge and radar rainfall data. 

Data users are cautioned to consider carefully the provisional nature of the information before using it for decisions. Information concerning the accuracy and appropriate uses of these data or concerning other hydrologic data may be obtained from the 3RWW.

### Historical Rain Gauge

The data from 33 rain gauges is archived in this section. The data may be retrieved for any combination of the rain gauges during a specified time span. The data may also be displayed in 15-minute increments or aggregated to hourly or daily data points.


### Calibrated Radar Rainfall

The calibrated radar rainfall section allows the retrieval of archived gauge-adjusted radar rainfall data for each of the 2313 pixels mapped by the NEXRAD radar cross-section. Calibration is performed by <a href="https://www.vieuxinc.com/" target="_blank">Vieux Associates</a>.

---

## Querying Rainfall

Select the start and end date/time, along with the interval and the gauges or basins (for radar pixels). Press "Get Rainfall Data" button to get the data.

Rainfall data is collected and stored in 15-minute increments, which allows for 15-minute, hourly, and daily aggregations to be calculated. Note that if a daily interval is selected, the start and end selections will begin at midnight and the start and end hour will be ignored.

Query results will be listed in a panel below on each page and shown on the map. The tabular data output may be viewed and downloaded on the page by selecting the 'View and Download Results' Button. Download formats currently include a CSV tabular format, for use in spreadsheet software. Spatial formats will be included in the future.

The output table for each query result contains:

* a gauge or pixel ID
* a date/time of the observation (presented as standard ISO 8061 datetime text). For hourly and daily aggregations, the start and end time of the observation is indicated using the standard ISO 8061 datetime range format, with start and end delimited by a "/".
* a rainfall amount (in inches) 
* a source code, which indicates where the rainfall measurement came from.

The source code can be found in the following table:

| Source |	Description |
| --- | --- |
| R |	Calibrated radar rainfall data |
| G-0 | No gauge or calibrated radar rainfall data is available, but not for the reasons given for N/D below |
| G-1 |	Derived from inverse distance squared weighting based on one rain gauge |
| G-2 |	Derived from inverse distance squared weighting based on two rain gauges |
| G-3 |	Derived from inverse distance squared weighting based on three rain gauges |
| N/D |	No data was collected for this data point. This may be because no data was collected at the time or the pixel may be outside of the data collection boundary. |
| RTRR | Real-time radar rainfall. Data shown are provisional.|
| RTRG | Real-time rain gauge data. Data shown are provisional. |

Note that the source code only appears for the 15-minute increments because an hourly or daily increment may include many different sources.

---

## 3RWW Data API

The rainfall data is served up from 3RWW's Data API. Currently, a few low-level API functions are documented and accessible through [${process.env.REACT_APP_API_URL_ROOT}](${process.env.REACT_APP_API_URL_ROOT}).

          `
        },
        // LegendButton: {
        //   title:"Map Legend",
        //   content: legend
        // }
      }
    };
  }

  handleClose(e) {
    this.setState({ show: false, showWhich: null });
  }

  handleShow(e) {
    console.log(e.target.id)
    this.setState({ show: true, showWhich: e.target.id });
  }

  render() {

    return (
      <div className="nav-container">
        <Navbar bg="primary" variant="dark" expand="md">

          <Navbar.Brand className="d-none d-sm-block">
            <img className="nav-brand-logo" src={`${ROOT}static/assets/3rww_logo_full_inverse_transparent.png`} alt="3RWW Logo" />&nbsp;
            Rainfall
            {/* <small className="text-muted d-none d-lg-inline">by 3 Rivers Wet Weather</small> */}
          </Navbar.Brand>
          <Navbar.Brand className="d-block d-sm-none" style={{ fontSize: 0.9 + 'rem' }}>
            <img className="nav-brand-logo-xs" src={`${ROOT}static/assets/3rww_logo_full_inverse_transparent.png`} alt="3RWW Logo" />&nbsp;
            Rainfall
          </Navbar.Brand>
          {/* <Navbar.Text>
            &nbsp;&nbsp;
            {this.props.isThinking === true || this.props.mapLoaded === false ? (
              <span className="fa-layers fa-fw">
                <FontAwesomeIcon icon={faSpinner} pulse size="4x"/>
                <FontAwesomeIcon icon={faCloudRain} size="2x" transform="right-8"/>
              </span>
            ) : ("")}
          </Navbar.Text> */}
          <Navbar.Toggle aria-controls="basic-navbar-nav" />

          <Navbar.Collapse id="basic-navbar-nav">
            <Nav variant="pills" className="mr-auto" defaultActiveKey={CONTEXT_TYPES.legacyRealtime}>
              <Nav.Item>
                <Nav.Link
                  active={this.props.tab === CONTEXT_TYPES.legacyRealtime}
                  eventKey={CONTEXT_TYPES.legacyRealtime}
                  onSelect={this.props.switchContext}
                >
                  Real-Time Rainfall
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link
                  active={this.props.tab === CONTEXT_TYPES.legacyGauge}
                  eventKey={CONTEXT_TYPES.legacyGauge}
                  onSelect={this.props.switchContext}
                >Historical Rain Gauge</Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link
                  active={this.props.tab === CONTEXT_TYPES.legacyGarr}
                  eventKey={CONTEXT_TYPES.legacyGarr}
                  onSelect={this.props.switchContext}
                >Calibrated Radar Rainfall</Nav.Link>
              </Nav.Item>
            </Nav>
            <Nav className="ml-auto">
              {/* <Nav.Item
                className="btn btn-outline-primary btn-sm"
                id="LegendButton"
                onClick={this.handleShow}              
                >
                Map Legend
              </Nav.Item> */}
              <Nav.Item
                className="btn btn-outline-light btn-sm"
                id="AboutButton"
                onClick={this.handleShow}
              >
                About
              </Nav.Item>
            </Nav>
          </Navbar.Collapse>
        </Navbar>

        <Modal
          show={this.state.show}
          onHide={this.handleClose}
          size="lg"
        >
          <Modal.Header closeButton>
            <Modal.Title>
              {
                (this.state.showWhich) ? this.state.content[this.state.showWhich].title : (null)
              }
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <ReactMarkdown
              source={
                (this.state.showWhich) ? this.state.content[this.state.showWhich].content : (null)
              }
              escapeHtml={false}
            />
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={this.handleClose}>
              Close
            </Button>
          </Modal.Footer>
        </Modal>
      </div>
    )
  }
}

function mapStateToProps(state) {
  return {
    isThinking: state.progress.isThinking > 0,
    mapLoaded: state.progress.mapLoaded,
    tab: state.progress.tab
  }
}

const mapDispatchToProps = {
  switchContext
}

export default connect(mapStateToProps, mapDispatchToProps)(Navigation);