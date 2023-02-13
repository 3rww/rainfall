import React, { Component } from 'react';
import { connect } from 'react-redux';
import { Navbar, Nav, Button, Modal, Col, Row } from 'react-bootstrap';
// import ReactMarkdown from 'react-markdown/with-html'

// icons
// import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
// import { faSpinner, faCloudRain } from '@fortawesome/free-solid-svg-icons'

// import {legend} from '../data/legend'
import { AboutContent } from './aboutContent'

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
              <Col lg={8}>
                <h1>3RWW Rainfall <small><em>beta</em></small></h1>
                <p className="lead">Map and download hyper-local rainfall measurements for Allegheny County</p>
              </Col>
              <Col>
                <small>A project by </small>
                <br></br><img className="brand-logo" src={`${ROOT}static/assets/3rww_logo_full_inverse_transparent_blue.png`} placeholder="3 River Wet Weather" alt="3RWW Logo" />
              </Col>
            </Row>
          ),
          content: <AboutContent/>
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
            Rainfall <small><em>beta</em></small>
            {/* <small className="text-muted d-none d-lg-inline">by 3 Rivers Wet Weather</small> */}
          </Navbar.Brand>
          <Navbar.Brand className="d-block d-sm-none" style={{ fontSize: 0.9 + 'rem' }}>
            <img className="nav-brand-logo-xs" src={`${ROOT}static/assets/3rww_logo_full_inverse_transparent.png`} alt="3RWW Logo" />&nbsp;
            Rainfall <small><em>beta</em></small>
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
              {(this.state.showWhich) ? this.state.content[this.state.showWhich].title : (null)}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
              {(this.state.showWhich) ? this.state.content[this.state.showWhich].content : (null)}
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