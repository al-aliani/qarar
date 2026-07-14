import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import AuthPage from './components/AuthPage';

// Simple router just to demonstrate both screens
const path = window.location.search;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <div style={{ fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}>
      {path.includes('auth') ? <AuthPage /> : <App />}
    </div>
  </React.StrictMode>
);
