import React from 'react';
import { connect } from 'react-redux';
import Spinner from 'react-bootstrap/Spinner';
// icons
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSpinner, faCloudRain } from '@fortawesome/free-solid-svg-icons'
import './thinkingOverlay.scss'

class ThinkingOverlay extends React.Component {

  render() {
    if (this.props.isAppThinking) {
      return (
        <div className="thinking-overlay">
          <div className="d-flex thinking-content">
            {/* <div className="d-flex justify-content-center my-auto"> */}
            <span className="fa-layers fa-fw">
                <FontAwesomeIcon icon={faSpinner} pulse size="8x"/>
                <FontAwesomeIcon icon={faCloudRain} size="4x" transform="right-8"/>
              </span>
              
            {/* <Spinner
              animation="grow"
              variant="primary"
              className="thinking-spinner"
            >
              <span className="sr-only">"Loading...</span>
            </Spinner> */}
          </div>
          <p className="debug-messages">{this.props.message}</p>
        </div>
      )
    } else {
      return (null)
    }

  }

}

function mapStateToProps(state) {
  let msgs = state.progress.messages
  return { 
    isAppThinking: state.progress.isThinking > 0,
    message: msgs[msgs.length - 1]
  }
}

export default connect(mapStateToProps)(ThinkingOverlay)