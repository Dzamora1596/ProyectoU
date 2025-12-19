import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AutenticarProvider } from './context/autenticarContext';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AutenticarProvider>
      <App />
    </AutenticarProvider>
  </React.StrictMode>
);
