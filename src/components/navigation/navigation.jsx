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