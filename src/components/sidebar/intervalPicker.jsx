
import React from 'react';
import { connect } from 'react-redux';
import { Form, Row, Col } from 'react-bootstrap'

import { pickInterval } from '../../store/actions'
import { getIntervalOptionsForContext } from '../../store/config'


class IntervalPicker extends React.Component {

  handleSelectInterval = e => {
    this.props.dispatchPickInterval(e.currentTarget.value)
  };

  render() {
    const intervalOptions = getIntervalOptionsForContext(this.props.contextType)

    return (
      <Row className="g-0">
        <Col lg={3}>
          <strong>Interval</strong>
        </Col>
        <Col lg={9}>
          <Form>
            {intervalOptions.map((opt, i) => (
              <Form.Check
                defaultChecked={opt === "15-minute"}
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
    )
  }

}

function mapStateToProps(state) {
  return {
  }
}

const mapDispatchToProps = (dispatch, ownProps) => {
  return {
    dispatchPickInterval: payload => {
      dispatch(pickInterval({ rollup: payload, contextType: ownProps.contextType }))
    }
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(IntervalPicker);
