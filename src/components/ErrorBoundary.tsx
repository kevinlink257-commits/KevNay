import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught POS Error caught by ErrorBoundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetStorage = () => {
    if (window.confirm('¿Deseas restablecer los datos locales de la terminal para solucionar el problema? Se conservarán los datos iniciales por defecto.')) {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch {}
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0c1322] text-[#dce2f7] flex items-center justify-center p-6 font-sans">
          <div className="max-w-xl w-full bg-[#161f36] border border-[#dc2626]/40 rounded-2xl p-8 shadow-2xl space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-[#dc2626]/20 border border-[#dc2626]/50 flex items-center justify-center text-[#ef4444]">
                <span className="material-symbols-outlined text-[32px]">warning</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white tracking-wide">
                  Recuperación de Terminal Kev Nay POS
                </h1>
                <p className="text-sm text-[#94a3b8]">
                  Se detectó una excepción en la ejecución. La terminal protegió la sesión.
                </p>
              </div>
            </div>

            <div className="bg-[#0b101e] border border-white/10 rounded-xl p-4 font-mono text-xs text-[#fca5a5] overflow-x-auto max-h-48">
              <p className="font-bold text-white mb-1">Detalle del error:</p>
              <p>{this.state.error?.message || 'Error desconocido'}</p>
              {this.state.error?.stack && (
                <pre className="mt-2 text-[10px] text-gray-400 whitespace-pre-wrap">
                  {this.state.error.stack.slice(0, 500)}
                </pre>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 py-3 px-5 rounded-xl bg-gradient-to-r from-[#dc2626] to-[#b91c1c] text-white font-semibold flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-red-900/30"
              >
                <span className="material-symbols-outlined text-[20px]">refresh</span>
                Reiniciar Terminal
              </button>
              <button
                type="button"
                onClick={this.handleResetStorage}
                className="py-3 px-5 rounded-xl bg-[#1e293b] hover:bg-[#334155] text-[#cbd5e1] font-medium flex items-center justify-center gap-2 active:scale-95 transition-all border border-white/10"
              >
                <span className="material-symbols-outlined text-[20px]">restart_alt</span>
                Restablecer Memoria
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
