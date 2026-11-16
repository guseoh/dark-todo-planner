import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AuthGate } from "./components/auth/AuthGate";
import { OfflineSyncIndicator } from "./components/common/OfflineSyncIndicator";
import "./styles/globals.css";
import { initializeTheme } from "./lib/theme";
import { startBootstrap } from "./lib/api/bootstrap";
import { markStartup } from "./lib/perf";

markStartup("js-start");
initializeTheme();
// Fetch the first-screen data while the session check is still in flight.
void startBootstrap();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthGate>{(logout) => <><App onLogout={logout} /><OfflineSyncIndicator /></>}</AuthGate>
  </React.StrictMode>,
);
