import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Unhandled React Error caught by ErrorBoundary:', error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-slate-800">
          <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-8 shadow-lg text-center">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4 border border-rose-200">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Application Notice</h2>
            <p className="text-sm text-slate-600 mb-4 leading-relaxed">
              BrandTrace AI encountered an unexpected interface error. Please verify the backend API server is running and retry.
            </p>
            {this.state.error?.message && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-mono text-slate-700 mb-6 text-left break-words max-h-32 overflow-y-auto">
                {this.state.error.message}
              </div>
            )}
            <button
              type="button"
              onClick={this.handleRetry}
              className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
