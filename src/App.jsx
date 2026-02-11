import React from 'react';
import { connect } from "react-redux";
import Navigation from './components/navigation/navigation';
import Layout from './components/layout';

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

      <div className="app-shell">
        <Navigation isloading={this.props.loading}/>
        <Layout />
      </div>

    );
  }

}

function mapStateToProps(state) {
  return { ...state.initMap }
}

export default connect(mapStateToProps)(App)
