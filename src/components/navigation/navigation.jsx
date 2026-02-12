import React, { useCallback, useMemo, useState } from 'react';
import { Navbar, Nav, Button, Modal, Col, Row, Alert, Popover, OverlayTrigger } from 'react-bootstrap';

// icons
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';

import { AboutContent } from './aboutContent';

import { CONTEXT_TYPES, ROOT } from '../../store/config';
import { switchContext } from '../../store/features/appThunks';
import { useAppDispatch, useAppSelector } from '../../store/hooks';

import './navigation.css';

const Navigation = () => {
  const dispatch = useAppDispatch();
  const tab = useAppSelector((state) => state.progress.tab);
  const globalNotice = useAppSelector((state) => state.globalConfig.globalNotice);

  const [show, setShow] = useState(true);
  const [showWhich, setShowWhich] = useState('AboutButton');

  const content = useMemo(() => ({
    AboutButton: {
      title: (
        <Row>
          <Col lg={8}>
            <h1>3RWW Rainfall</h1>
            <p className="lead">Map and download hyper-local rainfall measurements for Allegheny County</p>
          </Col>
          <Col>
            <small>A project by </small>
            <br />
            <img className="brand-logo" src={`${ROOT}static/assets/3rww_logo_full_inverse_transparent_blue.png`} placeholder="3 River Wet Weather" alt="3RWW Logo" />
          </Col>
        </Row>
      ),
      content: <AboutContent />
    }
  }), []);

  const handleClose = useCallback(() => {
    setShow(false);
    setShowWhich(null);
  }, []);

  const handleShow = useCallback((event) => {
    const targetId = event.currentTarget?.id;
    if (!targetId) {
      return;
    }
    setShow(true);
    setShowWhich(targetId);
  }, []);

  const handleContextSwitch = useCallback((contextType, event) => {
    if (event && typeof event.preventDefault === 'function') {
      event.preventDefault();
    }
    dispatch(switchContext(contextType));
  }, [dispatch]);

  return (
    <div className="nav-container">
      <Navbar bg="primary" variant="dark" expand="md">
        <Navbar.Brand className="d-none d-sm-block">
          <img className="nav-brand-logo" src={`${ROOT}static/assets/3rww_logo_full_inverse_transparent.png`} alt="3RWW Logo" />&nbsp;
          Rainfall
        </Navbar.Brand>
        <Navbar.Brand className="d-block d-sm-none" style={{ fontSize: 0.9 + 'rem' }}>
          <img className="nav-brand-logo-xs" src={`${ROOT}static/assets/3rww_logo_full_inverse_transparent.png`} alt="3RWW Logo" />&nbsp;
          Rainfall
        </Navbar.Brand>
        <Navbar.Toggle aria-controls="basic-navbar-nav" />

        <Navbar.Collapse id="basic-navbar-nav">
          <Nav variant="pills" className="me-auto py-2" defaultActiveKey={CONTEXT_TYPES.legacyRealtime}>
            <Nav.Item>
              <Nav.Link
                active={tab === CONTEXT_TYPES.legacyRealtime}
                eventKey={CONTEXT_TYPES.legacyRealtime}
                onClick={(event) => handleContextSwitch(CONTEXT_TYPES.legacyRealtime, event)}
              >
                Real-Time Rainfall
              </Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link
                active={tab === CONTEXT_TYPES.legacyGauge}
                eventKey={CONTEXT_TYPES.legacyGauge}
                onClick={(event) => handleContextSwitch(CONTEXT_TYPES.legacyGauge, event)}
              >
                Historical Rain Gauge
              </Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link
                active={tab === CONTEXT_TYPES.legacyGarr}
                eventKey={CONTEXT_TYPES.legacyGarr}
                onClick={(event) => handleContextSwitch(CONTEXT_TYPES.legacyGarr, event)}
              >
                Calibrated Radar Rainfall
              </Nav.Link>
            </Nav.Item>
          </Nav>
          <Nav className="ms-auto">
            {globalNotice.show ? (
              <OverlayTrigger
                trigger="click"
                placement={'bottom'}
                overlay={(
                  <Popover id="global-notice-popover">
                    <Popover.Header as="h3">{globalNotice.title}</Popover.Header>
                    <Popover.Body>{globalNotice.content}</Popover.Body>
                  </Popover>
                )}
              >
                <Nav.Item
                  as="button"
                  className={`mx-3 btn btn-sm text-light btn-${globalNotice.level}`}
                  id="noticePopover"
                >
                  <FontAwesomeIcon icon={faExclamationTriangle} />
                </Nav.Item>
              </OverlayTrigger>
            ) : null}
            <Nav.Item
              className="btn btn-outline-light btn-sm"
              id="AboutButton"
              onClick={handleShow}
            >
              About
            </Nav.Item>
          </Nav>
        </Navbar.Collapse>
      </Navbar>

      <Modal
        show={show}
        onHide={handleClose}
        size="xl"
      >
        <Modal.Header closeButton>
          <Modal.Title className="w-100">
            {showWhich ? content[showWhich]?.title : null}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {globalNotice.show ? (
            <Row className="my-3">
              <Col>
                <Alert variant={globalNotice.level}>
                  <Alert.Heading>{globalNotice.title}</Alert.Heading>
                  <p>{globalNotice.content}</p>
                </Alert>
              </Col>
            </Row>
          ) : ''}
          {showWhich ? content[showWhich]?.content : null}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleClose}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default Navigation;
