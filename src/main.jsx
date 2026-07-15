import './index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import AuthPage from './components/AuthPage';

// نفس مفتاح localStorage ومنطق web/js/theme-init.js — ثيم واحد متزامن عبر
// كل صفحات المنتج (اللوحة والتطبيق الرئيسي)، لا حالة منفصلة تنحرف عن الأخرى.
const storedTheme = localStorage.getItem('feas_theme') || 'light';
const effectiveTheme = storedTheme === 'auto'
  ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  : (storedTheme === 'light' ? 'light' : 'dark');
document.documentElement.setAttribute('data-theme', effectiveTheme);

// Simple router just to demonstrate both screens
const path = window.location.search;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <div style={{ fontFamily: "'IBM Plex Sans Arabic', system-ui, sans-serif" }}>
      {path.includes('auth') ? <AuthPage /> : <App />}
    </div>
  </React.StrictMode>
);
