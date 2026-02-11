import React from 'react';
import { connect } from 'react-redux';
import {Row, Col, Container} from 'react-bootstrap';
import { debounce } from 'lodash-es'
import { filterEventByHours } from '../../store/actions';


class EventFilter extends React.Component {

  constructor(props) {
   super(props);

   this.state = {
    currentPos: 24,
    }
    this.slideIt = debounce(this.slideIt.bind(this),1000);
 
  }

  slideIt = (v) => {
    console.log(v)

    if (v.target !== null) {
      let value = Number(v.target.value)
      this.setState({ currentPos: value })
    }

    if (v.target !== null) {
      this.props.onChangeMakeChoice(v)
    }
    
  }
 
  render() {
    return (
      <div>
        <label htmlFor="duration-slider">Filter Events | {this.state.currentPos} hours</label>
        <input
          type="range"
          min="1" 
          max="24"
          defaultValue={`${this.state.currentPos}`}
          className="form-range"
          id="duration-slider"
          onChange={this.slideIt}
        />        
      </div>
    )
  }


}

function mapStateToProps(state) {
  return {
   eventFilters: state.eventFilters
  }
 }
 
 const mapDispatchToProps = (dispatch, ownProps) => {
  return {
    onChangeMakeChoice: payload => {
      dispatch(filterEventByHours({maxHours: payload.target.value}))
    }
  }
 }
 
 export default connect(mapStateToProps, mapDispatchToProps)(EventFilterControls);
