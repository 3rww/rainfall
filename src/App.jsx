import React from 'react';
import { connect } from "react-redux";

import Navigation from './components/navigation/navigation';
import Layout from './components/layout';
// import { initDataFetch } from './store/middleware'

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

      <div style={{height: 100+'%'}}>
        <Navigation
          isloading={this.props.loading}
        />
        {/* <AppThining/> */}
        <Layout/>
      </div>

    );
  }

}

// const mapDispatchToProps = (dispatch, ownProps) => {
//   return {
//     initFetchData: payload => {
//       return dispatch(initDataFetch(payload))
//     }
//   }
// }

// export default connect(null, mapDispatchToProps)(App);
export default App;
