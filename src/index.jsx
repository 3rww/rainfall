import 'babel-polyfill'

import React from 'react';
import ReactDOM from 'react-dom';
// react-redux and the store
import { Provider } from "react-redux";
import store from "./store/index";
// custom style sheets
import './brand.scss';
import './index.scss';
// core application code
import App from './App';
// service worker
import * as serviceWorker from './serviceWorker';

console.log("Hello there curious person! The 3RWW Rainfall API is located at", process.env.REACT_APP_API_URL_ROOT, "- check it out for more powerful querying capability!")

// entrypoint for the react app
ReactDOM.render(
    <Provider store={store}>
        <App/>
    </Provider>, 
    document.getElementById('root')
);

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister();
