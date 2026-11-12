import React from "react";
import ReactDOM from "react-dom/client";

// M0: no window loads this yet. Popup and settings views arrive in M1 / M4.
function Placeholder() {
  return null;
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Placeholder />
  </React.StrictMode>,
);
