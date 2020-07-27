import React, { Component } from 'react';
import { connect } from 'react-redux';
import { Navbar, Nav, Button, Modal } from 'react-bootstrap';
import ReactMarkdown from 'react-markdown/with-html'

// icons
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSpinner, faCloudRain } from '@fortawesome/free-solid-svg-icons'

// import {legend} from '../data/legend'

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
            <div>
              Make it Rain
              <br></br><br></br>
              <small>A project by </small><img className="brand-logo" src="/static/assets/3rww_logo_full_inverse_transparent_blue.png" placeholder="3 River Wet Weather" alt="3RWW Logo"/>
            </div>
          ),
          content: ``
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
          <Navbar.Text>
            &nbsp;&nbsp;
            {/* {this.props.isThinking === true || this.props.mapLoaded === false ? (
              <span className="fa-layers fa-fw">
                <FontAwesomeIcon icon={faSpinner} pulse size="4x"/>
                <FontAwesomeIcon icon={faCloudRain} size="2x" transform="right-8"/>
              </span>
            ) : ("")} */}
            
          </Navbar.Text>          
          <Navbar.Toggle aria-controls="basic-navbar-nav" />

          <Navbar.Collapse id="basic-navbar-nav">
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
    mapLoaded: state.progress.mapLoaded
  }
}

export default connect(mapStateToProps)(Navigation);