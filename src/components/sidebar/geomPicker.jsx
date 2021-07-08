
import React from 'react';
import { connect } from 'react-redux';
import {
  Row,
  Col,
  Badge,
  Tabs,
  Tab
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
// import {
//   pickSensor
// } from '../../store/actions'
import {
  pickSensorFromMap
} from '../../store/middleware'
import {
  pluralize
} from '../../store/utils/index'

import { CONTEXT_TYPES } from '../../store/config'


class GeodataPicker extends React.Component {
  constructor(props) {
    super();

    this.handleOnApply = this.handleOnApply.bind(this);
    this.handleShow = this.handleShow.bind(this);
    this.handleClose = this.handleClose.bind(this);

    this.state = {
      show: false
    }

  }

  handleSelectGauge = selectedGauges => {
    this.props.dispatchPickSensorParam({
      sensorLocationType: "gauge",
      selectedOptions: selectedGauges // this is a list
    })
  };

  handleSelectPixel = selectedPixels => {
    this.props.dispatchPickSensorParam({
      sensorLocationType: "pixel",
      selectedOptions: selectedPixels // this is a list
    })
  };

  handleSelectBasin = selectedBasin => {
    this.props.dispatchPickSensorParam({
      sensorLocationType: "basin",
      selectedOptions: selectedBasin !== null ? [selectedBasin] : null // make this a list
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
    let gaugeCount = this.props.gaugeCount
    let pixelCount = this.props.pixelCount
    return (
      <div>
        <Row noGutters>
          <Col>
            <strong>Where</strong>
          </Col>
        </Row>

        <Row noGutters>
          <Col>
          
            <Tabs defaultActiveKey="sensor" id="geomPickerTypes">
              <Tab eventKey="sensor" title="Sensor" className="my-5">


                {(this.props.context !== CONTEXT_TYPES.legacyGarr) ? (
                // GAUGE SELECTOR
                <Row noGutters>
                  <Col md={2}>
                    <small>Rain Gauges</small>
                  </Col>
                  <Col md={8}>
                    <Select
                      isMulti
                      value={this.props.selectedGauges}
                      onChange={this.handleSelectGauge}
                      options={this.props.gaugeOpts}
                      menuPortalTarget={document.body}
                      isClearable
                    />
                  </Col>
                  <Col md={2}>
                    {(gaugeCount > 0) ? (
                      <span className="mx-1 my-1"><Badge pill variant="primary">
                        {`${gaugeCount} ${pluralize(gaugeCount, 'gauge', 'gauges')}`}
                      </Badge>
                      </span>
                    ) : (
                      null
                    )}
                  </Col>
                </Row>

                ):(
                  null
                )}

              {(this.props.context !== CONTEXT_TYPES.legacyGauge) ? (

                // BASIN / PIXEL SELECTOR
                <Row noGutters>
                  <Col md={2}>
                    <small>Radar Pixels</small>
                  </Col>
                  <Col md={8}>
                    {/* <Select
                      value={this.props.selectedBasin}
                      onChange={this.handleSelectBasin}
                      options={this.props.basinOpts}
                      menuPortalTarget={document.body}
                      isClearable
                    /> */}
                    <Select
                      isMulti
                      value={this.props.selectedPixels}
                      onChange={this.handleSelectPixel}
                      options={this.props.pixelOpts}
                      menuPortalTarget={document.body}
                      isClearable
                    />            
                  </Col>
                  <Col md={2}>
                  {(pixelCount > 0) ? (
                      <span className="mx-1 my-1"><Badge pill variant="primary">
                        {`${pixelCount} ${pluralize(pixelCount, 'pixel', 'pixels')}`}
                      </Badge>
                      </span>
                    ) : (
                      null
                    )}
                  </Col>          
                </Row>
                ):(
                  null
                )}

              </Tab>
              <Tab eventKey="geography" title="Geography" className="my-5">
                <p className="small"><em>Coming soon: select gauges and pixels by watershed or municipality</em></p>
              </Tab>
            </Tabs>
        
          </Col>      
        </Row>

      </div>

   

    );
  }
}

function mapStateToProps(state, ownProps) {
  var selectedPixels = selectPickedSensors(state, ownProps.contextType, 'pixel')
  var selectedGauges = selectPickedSensors(state, ownProps.contextType, 'gauge')

  return {

    gaugeOpts: selectMapStyleSourceDataFeatures(state, 'gauge')
      .map(i => ({ value: i.id, label: `${i.id}: ${i.properties.name}` })),
    basinOpts: selectPixelLookupsBasinsOnly(state)
      .map(i => ({ value: i.value, label: i.value })),
    pixelOpts: selectMapStyleSourceDataFeatures(state, 'pixel')
      .map(i => ({ value: i.id, label: `${i.id}`})),

    selectedBasin: selectPickedSensors(state, ownProps.contextType, 'basin'),
    selectedGauges: selectedGauges,
    selectedPixels: selectedPixels,

    pixelCount: selectedPixels.length,
    gaugeCount: selectedGauges.length,

    context: selectContext(state)
  }
}

const mapDispatchToProps = (dispatch, ownProps) => {
  return {
    dispatchPickSensorParam: payload => {
      // console.log("geompicker:")
      dispatch(pickSensorFromMap({...payload, contextType: ownProps.contextType, inputType: "geomPicker"}))
    }
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(GeodataPicker);