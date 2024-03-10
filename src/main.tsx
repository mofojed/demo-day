import React from "react";
import ReactDOM from "react-dom";
import { ThemeProvider } from "@deephaven/components";
import "@deephaven/components/scss/BaseStyleSheet.scss";
import App from "./App.tsx";
import "./index.css";

ReactDOM.render(
  <React.StrictMode>
    <ThemeProvider themes={[]}>
      <App />
    </ThemeProvider>
  </React.StrictMode>,
  document.getElementById("root")
);
