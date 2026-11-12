import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { PopupApp } from "./popup/PopupApp";
import { SkinProvider } from "./skin/SkinContext";
import "./styles/global.css";

function Root() {
  const label = getCurrentWindow().label;
  // The settings window arrives in M4.
  if (label !== "popup") return null;
  return (
    <SkinProvider id="native">
      <PopupApp />
    </SkinProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
