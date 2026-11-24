import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { DesktopAutoUpdate } from "./components/settings/DesktopAutoUpdate";
import { AuthGate } from "./components/auth/AuthGate";
import { OfflineSyncIndicator } from "./components/common/OfflineSyncIndicator";
import "./styles/globals.css";
import { initializeTheme } from "./lib/theme";
import { markStartup } from "./lib/perf";

markStartup("js-start");
initializeTheme();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthGate>{(logout) => <><App onLogout={logout} /><OfflineSyncIndicator /></>}</AuthGate>
    <DesktopAutoUpdate />
  </React.StrictMode>,
);
