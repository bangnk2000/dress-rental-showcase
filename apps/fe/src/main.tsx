import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './app/index.css';
import '@/lib/i18n'; // side-effect: initializes i18next before first render

import { App } from './app/app';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element #root not found');

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
