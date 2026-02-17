import React from 'react';
import {
  Modal,
  Button,
  Row,
  Col
} from 'react-bootstrap';
import DatePicker from 'react-datepicker';

import 'react-datepicker/dist/react-datepicker.css';

const DateRangeModal = ({
  show,
  onHide,
  onApply,
  contextType,
  ranges,
  pendingStart,
  pendingEnd,
  onPresetPick,
  onStartChange,
  onEndChange,
  minDate,
  maxDate,
  availabilityNote
}) => {
  return (
    <Modal
      show={show}
      onHide={onHide}
      size="lg"
      animation={false}
    >
      <Modal.Header closeButton>
        <Modal.Title>Select Date and Time Range</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Row className="g-3">
          <Col xs={3} className="border-end">
            <div className="btn-group-vertical w-100" role="group" aria-label="Quick Ranges">
              {Object.entries(ranges).map(([label, range]) => (
                <Button
                  key={`${contextType}-${label}`}
                  variant="outline-primary"
                  size="sm"
                  onClick={() => onPresetPick(label, range)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </Col>
          <Col xs={9}>
            <Row>
              <Col md={6}>
                <p className="lead mb-0">Start</p>
                <DatePicker
                  selected={pendingStart}
                  onChange={onStartChange}
                  showTimeSelect
                  timeIntervals={15}
                  dateFormat="MM/dd/yyyy hh:mm aa"
                  minDate={minDate.toDate()}
                  maxDate={maxDate.toDate()}
                  className="form-control"
                />
              </Col>
              <Col md={6}>
                <p className="lead mb-0">End</p>
                <DatePicker
                  selected={pendingEnd}
                  onChange={onEndChange}
                  showTimeSelect
                  timeIntervals={15}
                  dateFormat="MM/dd/yyyy hh:mm aa"
                  minDate={pendingStart || minDate.toDate()}
                  maxDate={maxDate.toDate()}
                  className="form-control"
                />
              </Col>
            </Row>
            <Row>
              <Col>
                <p className="datetimepicker-range-note mb-0">
                  {availabilityNote}
                </p>
              </Col>
            </Row>
          </Col>
        </Row>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Cancel
        </Button>
        <Button variant="primary" onClick={onApply}>
          Apply
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default DateRangeModal;
