import React from 'react';
import { connect } from "react-redux";
import {TabContainer} from 'react-bootstrap';
import Navigation from './components/navigation/navigation';
import Layout from './components/layout';
import { CONTEXT_TYPES } from './store/config'
import { switchContext } from './store/middleware'

class App extends React.Component {

  // componentDidMount() {

  //   // initial data fetches, including
  //   // * events
  //   // * pixels
  //   // * gauges
  //   this.props.initFetchData()

  // }

  render() {
    return (

      <div style={{ height: 100 + '%' }}>
        <TabContainer
          defaultActiveKey={CONTEXT_TYPES.legacyRealtime}
          id="rainfall-tabs"
          // mountOnEnter={true}
          onSelect={this.props.switchContext}
        >
          <Navigation isloading={this.props.loading}/>
          <Layout />
        </TabContainer>
      </div>

    );
  }

}

function mapStateToProps(state) {
  return { ...state.initMap }
}

const mapDispatchToProps = (dispatch, ownProps) => {
  return {
    switchContext: payload => {
      console.log("switching", payload)
      dispatch(switchContext(payload))
    }
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(App)
