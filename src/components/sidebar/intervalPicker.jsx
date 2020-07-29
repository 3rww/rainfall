
import React from 'react';
import { connect } from 'react-redux';
import { Form, Row, Col } from 'react-bootstrap'

import {
  selectMapStyleSourceDataFeatures,
  selectPixelLookupsBasinsOnly,
  selectPickedSensors
} from '../../store/selectors'
import {
  pickInterval
} from '../../store/actions'


class IntervalPicker extends React.Component {

  handleSelectInterval = e => {
    this.props.dispatchPickInterval(e.currentTarget.value)
  };

  options = [
    "15-minute",
    "Hourly",
    "Daily",
    "Total"
  ]

  render() {
    // const { selectedGauges, selectedBasin } = this.state;
    return (
      <Row noGutters>
        <Col md={3}>
          <strong>Interval</strong>
        </Col>
        <Col>
        <Form>
            {this.options.map((opt, i) => (
              <Form.Check
                defaultChecked={opt == "Total" ? true : false}
                inline
                // custom
                key={`interval-${opt}-${i}-${this.props.rainfallDataType}`}
                label={opt}
                value={opt}
                type="radio"
                id={`interval-${opt}-${this.props.rainfallDataType}`}
                name="intervalRadios"
                onChange={this.handleSelectInterval}
              />
            ))}
          </Form>        
        </Col>
      </Row>
    );
  }
}

function mapStateToProps(state) {
  return {
  }
}

const mapDispatchToProps = (dispatch, ownProps) => {
  return {
    dispatchPickInterval: payload => {
      // console.log(payload, ownProps.rainfallDataType)
      dispatch(pickInterval({rollup: payload, rainfallDataType: ownProps.rainfallDataType}))
    }
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(IntervalPicker);