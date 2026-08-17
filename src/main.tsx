import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AuthGate } from "./components/auth/AuthGate";
import { OfflineSyncIndicator } from "./components/common/OfflineSyncIndicator";
import "./styles/globals.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthGate>{(logout) => <><App onLogout={logout} /><OfflineSyncIndicator /></>}</AuthGate>
  </React.StrictMode>,
);
