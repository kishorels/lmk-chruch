import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import PresentationWindow from "./presentation/PresentationWindow";
import "./index.css";

const rootElement = document.getElementById("root");

const isPresentation = window.location.hash === "#/present";

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    {isPresentation ? <PresentationWindow /> : <App />}
  </React.StrictMode>
);
