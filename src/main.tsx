import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { AddWordApp } from "./addWord/AddWordApp";
import { PopupApp } from "./popup/PopupApp";
import { SettingsApp } from "./settingsWindow/SettingsApp";
import { useSettings } from "./settings/useSettings";
import { SkinProvider } from "./skin/SkinContext";
import "./styles/fonts.css";
import "./styles/global.css";

function Root() {
  const label = getCurrentWindow().label;
  const settings = useSettings();
  return (
    <SkinProvider choice={settings.skin}>
      {label === "popup" && <PopupApp settings={settings} />}
      {label === "settings" && <SettingsApp settings={settings} />}
      {label === "addword" && <AddWordApp settings={settings} />}
    </SkinProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
