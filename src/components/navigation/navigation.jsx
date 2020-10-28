import React, { Component } from 'react';
import { connect } from 'react-redux';
import { Navbar, Nav, Button, Modal, Col, Row } from 'react-bootstrap';
import ReactMarkdown from 'react-markdown/with-html'

// icons
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSpinner, faCloudRain } from '@fortawesome/free-solid-svg-icons'

// import {legend} from '../data/legend'

import { RAINFALL_TYPES, CONTEXT_TYPES } from '../../store/config'

import { switchTab } from '../../store/actions'

import './navigation.scss';

class Navigation extends Component {

  constructor(props, context) {
    super(props, context);

    this.handleShow = this.handleShow.bind(this);
    this.handleClose = this.handleClose.bind(this);

    this.state = {
      show: false,
      showWhich: null,
      content: {
        AboutButton: {
          title: (
            <Row>
              <Col sm={9}>
                <h1>Make It Rain <small><em>beta</em></small></h1>
                <h2><small>Hyper-local rainfall data for Allegheny County</small></h2>
              </Col>
              <Col>
                <small>A project by </small>
                <br></br><img className="brand-logo" src="/static/assets/3rww_logo_full_inverse_transparent_blue.png" placeholder="3 River Wet Weather" alt="3RWW Logo" />
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

## Real-time Rainfall Data

Data from 33 rain gauges is collected and updated every 15 minutes to calibrate live weather radar to provide accurate, quality rainfall information as it is occurring.

Rain gauge data also is available in this section for the most recent 30-to-60-day period, spanning from the first day of the previous month to the current date in the present month. (Example: If the date is November 15, data can be obtained for as little as one day up to 45 days—October 1-November 15. If it is the last day of the present month—November 30—a full 60 days of data is available).

Fully calibrated rainfall data (older than 30 days with completed QA/QC) for any given month is available through the "Calibrated Radar Rainfall Data" section, generally within 15 days of the end of each month.

Several options for data output are provided on the real-time site via simple links.

* A bar graph and data table (in 15-min. increments) showing rainfall over the last 4 hours for a specified pixel on the map (2,276 pixels are available).
* An animated map showing the rainfall over the last 2-hour, 4-hour or 6-hour time period.
* A table recording the raw rainfall data for individual rain gauges over the last 30-60 days.
* A cumulative color-coded map showing the amount of rainfall occurring over a specified period. Data can be accessed from the first day of the previous month to the current date. Be sure to specify the time period, and select the appropriate rainfall scale (.5 inch, 5 inches or 10 inches.) For particularly long periods of time or heavy rainfall periods, a higher scale will provide a better range of colors in the final map.
* Rainfall amount collected over the most recent 4-hour period by an individual rain gauge. A bar graph and data table show the actual rainfall collected by the specific gauge in 15-min. increments. 

## Historical Rain Gauge

The data from 33 rain gauges is archived in this section. The data may be retrieved for any combination of the rain gauges during a specified time span. The data may also be displayed in 15-minute increments or compressed to hourly or daily data points. The data may be viewed on the page or downloaded into a comma-separated output format which may be saved and loaded into a spreadsheet or database that accepts comma-separated files.


## Calibrated Radar Rainfall

The calibrated radar rainfall section allows the retrieval of data for each of the 2313 pixels mapped by the radar cross-section.

---

## Querying Rainfall

Select the start and end date/time, along with the interval. Rainfall data is collected and stored in 15-minute increments, which allows for 15-minute, hourly, and daily intervals as options for the selectable increment. Note that if a daily increment is selected, the start and end selections will begin at midnight and the start and end hour will be ignored.

Querying results will listed in a panel below. The data output may be viewed and downloaded on the page by selecting the 'View and Download Results' Button 

The output for each timestamp contains a gauge or pixel ID, a rainfall amount, and a source code. The amount is the rainfall in inches. The source can be found in the following table:

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
            <img className="nav-brand-logo" src="/static/assets/3rww_logo_full_inverse_transparent.png" alt="3RWW Logo" />&nbsp;
            Rainfall
            {/* <small className="text-muted d-none d-lg-inline">by 3 Rivers Wet Weather</small> */}
          </Navbar.Brand>
          <Navbar.Brand className="d-block d-sm-none" style={{ fontSize: 0.9 + 'rem' }}>
            <img className="nav-brand-logo-xs" src="/static/assets/3rww_logo_full_inverse_transparent.png" alt="3RWW Logo" />&nbsp;
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
                  active={this.props.tab == CONTEXT_TYPES.legacyRealtime}
                  eventKey={CONTEXT_TYPES.legacyRealtime}
                  onSelect={this.props.switchTab}
                >
                  Real-Time Rainfall
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link
                  active={this.props.tab == CONTEXT_TYPES.legacyGauge}
                  eventKey={CONTEXT_TYPES.legacyGauge}
                  onSelect={this.props.switchTab}
                >Historical Rain Gauge</Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link
                  active={this.props.tab == CONTEXT_TYPES.legacyGarr}
                  eventKey={CONTEXT_TYPES.legacyGarr}
                  onSelect={this.props.switchTab}
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
  switchTab
}

export default connect(mapStateToProps, mapDispatchToProps)(Navigation);