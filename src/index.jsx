import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import App from "./App";
import "bootswatch/dist/materia/bootstrap.min.css";
import "./brand.css";
import "./index.css";
import store from "./store/index";
import { API_URL_ROOT } from "./store/config";

console.log(
  "Hello there curious person! The 3RWW Rainfall API is located at",
  API_URL_ROOT,
  "- check it out for more powerful querying capability!"
);

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Missing #root element");
}

createRoot(rootElement).render(
  <Provider store={store}>
    <App />
  </Provider>
);
