
import React from 'react';
import { connect } from 'react-redux';
import {
  Row,
  Col,
  Modal,
  Button,
} from 'react-bootstrap'

import Select from 'react-select';

// icons
// import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
// import { faCalendar, faList } from '@fortawesome/free-solid-svg-icons'

import {
  selectMapStyleSourceDataFeatures,
  selectPixelLookupsBasinsOnly,
  selectPickedSensors,
  selectContext
} from '../../store/selectors'
import {
  pickSensor
} from '../../store/actions'

import { CONTEXT_TYPES } from '../../store/config'


class GeodataPicker extends React.Component {
  constructor(props) {
    super(props);

    this.handleOnApply = this.handleOnApply.bind(this);
    this.handleShow = this.handleShow.bind(this);
    this.handleClose = this.handleClose.bind(this);

    this.state = {
      show: false
    }

  }

  handleSelectGauge = selectedGauges => {
    this.props.dispatchPickSensorParam({
      rainfallDataType: this.props.rainfallDataType,
      sensorLocationType: "gauge",
      selectedOptions: selectedGauges // this is a list
    })
  };

  handleSelectBasin = selectedBasin => {
    this.props.dispatchPickSensorParam({
      rainfallDataType: this.props.rainfallDataType,
      sensorLocationType: "basin",
      selectedOptions: [selectedBasin] // make this a list
    })
  };

  handleOnApply() {
    return;
  }

  handleClose(e) {
    this.setState({ show: false });
  }

  handleShow(e) {
    this.setState({ show: true });
  }

  render() {
    // const { selectedGauges, selectedBasin } = this.state;
    return (
      <div>
        <Row noGutters>
          <Col>
            <strong>Where</strong>
          </Col>
        </Row>

        {(this.props.context !== CONTEXT_TYPES.legacyGarr) ? (
        <Row noGutters>
          <Col md={3}>
            <small>Rain Gauges</small>
          </Col>
          <Col md={9}>
            <Select
              isMulti
              value={this.props.selectedGauges}
              onChange={this.handleSelectGauge}
              options={this.props.raingaugeOpts}
              menuPortalTarget={document.body}
              isClearable
            />
          </Col>
        </Row>
        ):(
          null
        )}

      {(this.props.context !== CONTEXT_TYPES.legacyGauge) ? (
        <Row noGutters>
          <Col md={3}>
            <small>Pixels (by Basin)</small>
          </Col>
          <Col md={9}>
            <Select
              value={this.props.selectedBasin}
              onChange={this.handleSelectBasin}
              options={this.props.basinOpts}
              menuPortalTarget={document.body}
              isClearable
            />
          </Col>
        </Row>
        ):(
          null
        )}

        {/* <Modal show={this.state.show} onHide={this.handleClose} size="lg" >
          <Modal.Header closeButton>
            <Modal.Title>
              Upload an area of interest polygon
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            Text field
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={this.handleClose}>
              Close
            </Button>
          </Modal.Footer>
        </Modal> */}

      </div>

    );
  }
}

function mapStateToProps(state, ownProps) {
  return {
    raingaugeOpts: selectMapStyleSourceDataFeatures(state, 'gauge')
      .map(i => ({ value: i.id, label: `${i.id}: ${i.properties.name}` })),
    basinOpts: selectPixelLookupsBasinsOnly(state)
      .map(i => ({ value: i.value, label: i.value })),
    selectedBasin: selectPickedSensors(state, ownProps.rainfallDataType, 'basin'),
    selectedRaingauges: selectPickedSensors(state, ownProps.rainfallDataType, 'raingauge'),
    context: selectContext(state)
  }
}

const mapDispatchToProps = (dispatch, ownProps) => {
  return {
    dispatchPickSensorParam: payload => {
      dispatch(pickSensor(payload))
    }
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(GeodataPicker);