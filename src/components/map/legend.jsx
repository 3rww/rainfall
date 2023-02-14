import React from 'react'
import { connect } from 'react-redux';
import { Table, Row, Col, Form } from 'react-bootstrap'
import { isEmpty } from 'lodash-es'
import * as chroma from 'chroma-js'

import { symbolBinLookup, LEGEND_BREAKS } from '../../store/config'
import { applyColorStretch } from '../../store/actions'


import './legend.scss'

class MapLegend extends React.Component {

  handleSelectLegend = e => {
    this.props.dispatchPickLegend(e.currentTarget.value)
    // console.log(e.currentTarget.value)
  };

  render() {
    return (


    <Row className="my-2">
      <Col sm={2}>
          <Form>
            <Form.Check custom size="sm" value="breaks_005" label="0.5 in." name="legendRadios" type="radio" id="legend-radio-1" onChange={this.handleSelectLegend}/>
            <Form.Check defaultChecked custom size="sm" value="breaks_050" label="5 in." name="legendRadios" type="radio" id="legend-radio-2" onChange={this.handleSelectLegend}/>
            <Form.Check custom size="sm" value="breaks_100" label="10 in." name="legendRadios" type="radio" id="legend-radio-3" onChange={this.handleSelectLegend}/>
          </Form>
      </Col>
      <Col sm={10}>
        <Table size="sm">
          <tbody>
            <tr>
              {this.props.bins.map((b, bi) => (
                
                <td 
                  key={bi}
                  className="text-center legend-label"
                  style={{backgroundColor : `${b[1]}`}}
                >
                  <span 
                    style={{color : `${b[2]}`}}>
                    {b[0]}
                  </span> 
                </td>

              ))}
            </tr>
          </tbody>
        </Table>
        <span class="form-check-label">Total Rainfall</span>
      </Col>

    </Row>

    )
  }
}

function mapStateToProps(state) {

  let legendContent = !isEmpty(state.mapLegend) ? state.mapLegend : false

  let bins = (legendContent) ? legendContent.content : []

  // generate legend bins with labels and colors
  // generate a font color based on luminance https://gka.github.io/chroma.js/#color-luminance
  // e.g., if luminance < 0.5, color = white, else black
  bins = bins.map((b, bi) => {

    let c = "#000"
    if (chroma(b[1]).luminance() < 0.4) {
      c = "#fff"
    }
    return [b[0], b[1], c]
  })

  return {
    bins: bins
  };

}

const mapDispatchToProps = (dispatch, ownProps) => {
  return {
    dispatchPickLegend: payload => {
      dispatch(
        applyColorStretch({
          breaks: LEGEND_BREAKS[payload]
        })
      )
    }
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(MapLegend);