import React from 'react';
import { connect } from "react-redux";

import Navigation from './components/navigation/navigation';
import Layout from './components/layout';

class App extends React.Component {

  render() {
    return (

      <div style={{height: 100+'%'}}>
        <Navigation
          isloading={this.props.loading}
        />
        <Layout/>
      </div>

    );
  }

}

export default App
