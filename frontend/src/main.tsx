import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider } from './context/AuthContext';
import './index.css';

// Global Google Maps error interception to prevent unhandled script crashes
if (typeof window !== 'undefined') {
  (window as any).gm_authFailure = () => {
    window.dispatchEvent(new CustomEvent('gmp-auth-failure'));
  };

  window.addEventListener('error', (event) => {
    const msg = event.message || '';
    const src = event.filename || '';
    if (
      msg.includes('InvalidKeyMapError') ||
      msg.includes('Script error') ||
      msg.includes('Google Maps') ||
      src.includes('maps.googleapis.com') ||
      src.includes('maps.gstatic.com')
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
      window.dispatchEvent(new CustomEvent('gmp-auth-failure'));
      return true;
    }
  }, true);

  window.addEventListener('unhandledrejection', (event) => {
    const reasonStr = String(event.reason || '');
    if (
      reasonStr.includes('InvalidKeyMapError') ||
      reasonStr.includes('Google Maps') ||
      reasonStr.includes('gm_authFailure')
    ) {
      event.preventDefault();
      window.dispatchEvent(new CustomEvent('gmp-auth-failure'));
    }
  });

  const origError = console.error;
  console.error = (...args: unknown[]) => {
    const msg = args.map((a) => String(a)).join(' ');
    if (
      msg.includes('InvalidKeyMapError') ||
      msg.includes('ApiProjectMapError') ||
      msg.includes('MissingKeyMapError') ||
      msg.includes('RefererNotAllowedMapError') ||
      msg.includes('BillingNotEnabledMapError') ||
      msg.includes('Google Maps JavaScript API error')
    ) {
      window.dispatchEvent(new CustomEvent('gmp-auth-failure'));
      // Keep console clean
      return;
    }
    origError.apply(console, args);
  };
}

createRoot(document.getElementById('root')!).render(
  <AuthProvider>
    <App />
  </AuthProvider>
);
