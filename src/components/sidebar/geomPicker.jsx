import React from 'react';
import { connect } from 'react-redux';
import {
  Row,
  Col,
  Badge,
  Tabs,
  Tab
} from 'react-bootstrap'
import {keys} from 'lodash-es';

import Select from 'react-select';

// icons
// import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
// import { faCalendar, faList } from '@fortawesome/free-solid-svg-icons'

import {
  selectMapStyleSourceDataFeatures,
  selectGeographyLookupsAsGroupedOptions,
  selectPickedSensors,
  selectContext
} from '../../store/selectors'
// import {
//   pickSensor
// } from '../../store/actions'
import {
  pickSensorMiddleware,
  pickSensorByGeographyMiddleware
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
    let gaugeCount = this.props.gaugeCount
    let pixelCount = this.props.pixelCount
    return (
      <div>
        <Row className="g-0 mb-2">
          <Col>
            <strong>Where</strong>
              {(gaugeCount > 0) ? (
                <span className="mx-1 my-1"><Badge pill bg="primary">
                  {`${gaugeCount} ${pluralize(gaugeCount, 'gauge', 'gauges')}`}
                </Badge>
                </span>
              ) : (
                null
              )}                 
              {(pixelCount > 0) ? (
                <span className="mx-1 my-1"><Badge pill bg="primary">
                  {`${pixelCount} ${pluralize(pixelCount, 'pixel', 'pixels')}`}
                </Badge>
                </span>
              ) : (
                null
              )}
          </Col>
        </Row>

        <Row className="g-0">
          <Col>
          
            <Tabs defaultActiveKey="sensor" id="geomPickerTypes">
              <Tab eventKey="sensor" title="By Sensor" className="my-4">


                {(this.props.context !== CONTEXT_TYPES.legacyGarr) ? (
                // GAUGE SELECTOR
                <Row className="g-0">
                  <Col md={3}>
                    <small>Rain Gauges</small>
                  </Col>
                  <Col md={9}>
                    <Select
                      isMulti
                      value={this.props.selectedGauges}
                      onChange={this.props.handleSelectGauge}
                      options={this.props.gaugeOpts}
                      menuPortalTarget={document.body}
                      isClearable
                    />
                  </Col>
                  {/* <Col md={2}>
                    {(gaugeCount > 0) ? (
                      <span className="mx-1 my-1"><Badge pill variant="primary">
                        {`${gaugeCount} ${pluralize(gaugeCount, 'gauge', 'gauges')}`}
                      </Badge>
                      </span>
                    ) : (
                      null
                    )}
                  </Col> */}
                </Row>

                ):(
                  null
                )}

              {(this.props.context !== CONTEXT_TYPES.legacyGauge) ? (

                // PIXEL SELECTOR
                <Row className="g-0">
                  <Col md={3}>
                    <small>Radar Pixels</small>
                  </Col>
                  <Col md={9}>
                    <Select
                      isMulti
                      value={this.props.selectedPixels}
                      onChange={this.props.handleSelectPixel}
                      options={this.props.pixelOpts}
                      menuPortalTarget={document.body}
                      isClearable
                    />            
                  </Col>
                  {/* <Col md={2}>
                  {(pixelCount > 0) ? (
                      <span className="mx-1 my-1"><Badge pill variant="primary">
                        {`${pixelCount} ${pluralize(pixelCount, 'pixel', 'pixels')}`}
                      </Badge>
                      </span>
                    ) : (
                      null
                    )}
                  </Col>           */}
                </Row>
                ):(
                  null
                )}

              </Tab>
              <Tab eventKey="geography" title="By Geography" className="my-4">
              <Row className="g-0">
                  <Col md={12}>
                  <Select
                      placeholder="Select radar pixels by basin, municipality, or watershed"
                      isMulti
                      // value={this.props.selectedBasin}
                      onChange={this.props.handleSelectGeography}
                      options={this.props.geographyOpts}
                      menuPortalTarget={document.body}
                      isClearable
                    />                         
                  </Col>
              </Row>
              
              </Tab>
            </Tabs>
        
          </Col>      
        </Row>

      </div>

   

    );
  }
}

function mapStateToProps(state, ownProps) {

  // the active tab
  var context = selectContext(state)

  // pixel selection options
  var pixelOpts = selectMapStyleSourceDataFeatures(state, 'pixel')
    .map(i => ({ value: i.properties.id, label: `${i.properties.id}`}))
  var selectedPixels = selectPickedSensors(state, ownProps.contextType, 'pixel')

  // gauge selection options
  var gaugeOpts = selectMapStyleSourceDataFeatures(state, 'gauge')
    .filter(i => i.properties.active === true)
    .map(i => ({ value: i.properties.id, label: `${i.properties.id}: ${i.properties.name}` }))
  var selectedGauges = selectPickedSensors(state, ownProps.contextType, 'gauge')
  
  // geography selection options
  var geographyOpts = selectGeographyLookupsAsGroupedOptions(state)
  var selectedGeographies = selectPickedSensors(state, ownProps.contextType, 'basin')
  
  return {
    gaugeOpts: gaugeOpts,
    pixelOpts: pixelOpts,
    geographyOpts: geographyOpts, 
    selectedBasin: selectedGeographies,
    selectedGauges: selectedGauges,
    selectedPixels: selectedPixels,
    pixelCount: selectedPixels.length,
    gaugeCount: selectedGauges.length,
    context: context
  }
}

/**
 * gauge and pixel selection is handed to pickSensorFromMap middleware, which
 * fires updates state and fires map highlight action
 * boundary selection is handed to pickSensorWithGeography middleware, which
 * first crosswalks the boundary to associated pixels+gauges, and then passes 
 * that to pickSensorFromMap middleware
 */
const mapDispatchToProps = (dispatch, ownProps) => {
  return {
    handleSelectGauge: payload => {
      dispatch(pickSensorMiddleware({
        contextType: ownProps.contextType, 
        inputType: "geomPicker",
        sensorLocationType: "gauge",
        selectedOptions: payload // this is a list of gauges
      }))
    }, 
    handleSelectPixel: payload => {
      dispatch(pickSensorMiddleware({
        contextType: ownProps.contextType, 
        inputType: "geomPicker",
        sensorLocationType: "pixel",
        selectedOptions: payload // this is a list of pixels
      }))
    }, 
    handleSelectGeography: payload => {
      // console.log(payload)
      dispatch(pickSensorByGeographyMiddleware({
        contextType: ownProps.contextType, 
        inputType: "geomPicker",
        sensorLocationType: "geography",
        selectedOptions: payload // this is a list of geography options
      }))
    }
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(GeodataPicker);
