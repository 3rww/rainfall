import React from "react";
import Navigation from './components/navigation/navigation';
import Layout from './components/layout';
import { useAppSelector } from "./store/hooks";

const App = () => {
  const loading = useAppSelector((state) => state.initMap.loading);

  return (
    <div className="app-shell">
      <Navigation isloading={loading} />
      <Layout />
    </div>
  );
};

export default App;
