import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

const container = document.getElementById('root');

if (!container) {
  console.error('Fatal: #root container element was not found in the DOM.');
} else {
  try {
    const root = createRoot(container);
    root.render(
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    );
  } catch (error: any) {
    console.error('Fatal error during React root creation:', error);
    container.innerHTML = `
      <div style="min-height: 100vh; background-color: #0c1322; color: #dce2f7; display: flex; align-items: center; justify-content: center; padding: 24px; font-family: system-ui, sans-serif;">
        <div style="max-width: 480px; width: 100%; background: #161f36; border: 1px solid rgba(220, 38, 38, 0.5); border-radius: 16px; padding: 24px; text-align: center; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
          <div style="width: 48px; height: 48px; background: rgba(220, 38, 38, 0.2); border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; color: #ef4444; margin-bottom: 16px; font-size: 24px;">⚠️</div>
          <h2 style="color: #ffffff; font-size: 18px; font-weight: 700; margin: 0 0 8px 0;">Error de Inicialización</h2>
          <p style="color: #94a3b8; font-size: 13px; margin: 0 0 20px 0;">La terminal encontró un problema al iniciar los componentes: ${error?.message || 'Error de arranque'}</p>
          <div style="display: flex; gap: 10px; justify-content: center;">
            <button onclick="window.location.reload();" style="padding: 10px 18px; background: #dc2626; color: white; border: none; border-radius: 10px; font-weight: 600; cursor: pointer;">Recargar</button>
            <button onclick="try { localStorage.clear(); sessionStorage.clear(); } catch(e){}; window.location.reload();" style="padding: 10px 18px; background: #232a3a; color: #cbd5e1; border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; font-weight: 500; cursor: pointer;">Restablecer Datos</button>
          </div>
        </div>
      </div>
    `;
  }
}
