import React from "react";
import { createRoot } from "react-dom/client";
import Laminar from "./Laminar.jsx";

// persist=true turns on browser-local storage for the case log.
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Laminar persist />
  </React.StrictMode>
);
