import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || 'Ocorreu um erro inesperado na aplicação.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Application ErrorBoundary:', error, info);
  }

  render() {
    if (this.state.hasError) {
      let friendlyText = this.state.errorMessage;
      try {
        const parsed = JSON.parse(this.state.errorMessage) as { error?: string };
        if (parsed && parsed.error) {
          friendlyText = parsed.error;
        }
      } catch {
        // Keep original message if not JSON
      }

      return (
        <div className="min-h-screen bg-[#F7F8FA] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl p-6">
            <h1 className="font-display text-lg font-semibold text-slate-900">
              Erro de conexão ou permissão
            </h1>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Não foi possível concluir a operação no banco de dados.
            </p>
            <p className="mt-3 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono-num text-slate-700 break-words">
              {friendlyText}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 w-full h-10 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium cursor-pointer"
            >
              Recarregar página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
