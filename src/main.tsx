import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';

// GLOBAL CONSOLE PROTECTION: Protects against platform/iframe-interceptor circular stringify crashes
const originalError = console.error;
const originalWarn = console.warn;

function safeSanizeValue(val: any, seen = new WeakSet()): any {
  if (val === null || val === undefined) return val;
  if (typeof val !== 'object') return val;
  
  if (seen.has(val)) return '[Circular]';
  seen.add(val);

  if (val instanceof Error) {
    return {
      message: val.message,
      code: (val as any).code,
      name: val.name,
      stack: val.stack
    };
  }

  // Handle Firebase/Firestore minified internal objects which have very short minified class names
  if (val.constructor && val.constructor.name && val.constructor.name.length <= 3) {
    return `[FirebaseInternal: ${val.constructor.name}]`;
  }

  try {
    if (val instanceof HTMLElement || val instanceof Window || val instanceof Document) {
      return '[DOM Node]';
    }
  } catch (e) {}

  if (Array.isArray(val)) {
    return val.map(item => {
      try {
        return safeSanizeValue(item, seen);
      } catch {
        return '[Unreadable Item]';
      }
    });
  }

  const cleanObj: any = {};
  for (const key of Object.keys(val)) {
    try {
      cleanObj[key] = safeSanizeValue(val[key], seen);
    } catch {
      cleanObj[key] = '[Unreadable Property]';
    }
  }
  return cleanObj;
}

console.error = function(...args: any[]) {
  const seen = new WeakSet();
  const safeArgs = args.map(arg => {
    try {
      return typeof arg === 'object' ? safeSanizeValue(arg, seen) : arg;
    } catch {
      return '[Sanitization Failed]';
    }
  });
  originalError.apply(console, safeArgs);
};

console.warn = function(...args: any[]) {
  const seen = new WeakSet();
  const safeArgs = args.map(arg => {
    try {
      return typeof arg === 'object' ? safeSanizeValue(arg, seen) : arg;
    } catch {
      return '[Sanitization Failed]';
    }
  });
  originalWarn.apply(console, safeArgs);
};

import App from './App.tsx';
import './index.css';
import "leaflet/dist/leaflet.css";

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
