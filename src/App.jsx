import React from "react";
import { Navigation, Layout } from './components/app-shell';
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
