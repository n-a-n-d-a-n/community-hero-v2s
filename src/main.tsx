// Catch and suppress benign Vite/WebSocket HMR connection warnings to keep preview smooth and clean
if (typeof window !== "undefined") {
  // Override console.error to filter out WebSocket/HMR/Vite connection alerts
  const originalError = console.error;
  console.error = function (...args) {
    const errorMsg = args.map(arg => typeof arg === "object" ? (arg?.message || JSON.stringify(arg)) : String(arg)).join(" ");
    if (
      errorMsg.includes("WebSocket") || 
      errorMsg.includes("websocket") || 
      errorMsg.includes("vite") || 
      errorMsg.includes("HMR") || 
      errorMsg.includes("WebSocket closed without opened") ||
      errorMsg.includes("connect to websocket")
    ) {
      return; // filter out
    }
    originalError.apply(console, args);
  };

  // Override console.warn to filter out WebSocket/HMR/Vite connection alerts
  const originalWarn = console.warn;
  console.warn = function (...args) {
    const warnMsg = args.map(arg => typeof arg === "object" ? (arg?.message || JSON.stringify(arg)) : String(arg)).join(" ");
    if (
      warnMsg.includes("WebSocket") || 
      warnMsg.includes("websocket") || 
      warnMsg.includes("vite") || 
      warnMsg.includes("HMR") || 
      warnMsg.includes("WebSocket closed without opened") ||
      warnMsg.includes("connect to websocket")
    ) {
      return; // filter out
    }
    originalWarn.apply(console, args);
  };

  window.addEventListener("unhandledrejection", (event) => {
    try {
      const reason = event.reason;
      let message = "";
      if (reason) {
        if (typeof reason === "string") {
          message = reason;
        } else if (typeof reason === "object") {
          message = [
            reason.message,
            reason.description,
            reason.reason,
            reason.name,
            reason.type,
            typeof reason.toString === "function" ? reason.toString() : ""
          ].filter(Boolean).join(" ");
        } else {
          message = String(reason);
        }
      }
      const isBenign = 
        message.toLowerCase().includes("websocket") || 
        message.toLowerCase().includes("vite") || 
        message.toLowerCase().includes("hmr") ||
        message.toLowerCase().includes("web-socket") ||
        (reason && String(reason).toLowerCase().includes("websocket"));

      if (isBenign) {
        event.preventDefault();
        event.stopPropagation();
      }
    } catch (e) {
      // Squelch errors in the error filter itself
    }
  });

  window.addEventListener("error", (event) => {
    try {
      const message = event.message || "";
      const errorStr = event.error ? String(event.error) : "";
      const errorReason = event.error?.reason || "";
      const errorMessage = event.error?.message || "";
      
      const combined = [message, errorStr, errorReason, errorMessage].join(" ").toLowerCase();
      
      const isBenign = 
        combined.includes("websocket") || 
        combined.includes("vite") || 
        combined.includes("hmr") ||
        combined.includes("web-socket");

      if (isBenign) {
        event.preventDefault();
        event.stopPropagation();
      }
    } catch (e) {
      // Squelch errors in the error filter itself
    }
  });
}

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
