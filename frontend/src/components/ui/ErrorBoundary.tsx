import { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 24px',
          textAlign: 'center',
          minHeight: 300,
        }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: 'var(--radius-full)',
            background: 'var(--error-bg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
          }}>
            <AlertTriangle size={28} color="var(--error)" />
          </div>
          <h3 style={{
            fontSize: 'var(--text-lg)',
            fontWeight: 600,
            color: 'var(--ink)',
            marginBottom: 6,
          }}>
            Something went wrong
          </h3>
          <p style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--ink-secondary)',
            maxWidth: 400,
            marginBottom: 16,
          }}>
            An unexpected error occurred. Please try again or contact support if the problem persists.
          </p>
          {this.state.error && (
            <pre style={{
              fontSize: 'var(--text-xs)',
              fontFamily: 'var(--font-mono)',
              color: 'var(--error)',
              background: 'var(--error-bg)',
              padding: '8px 12px',
              borderRadius: 'var(--radius-md)',
              maxWidth: 500,
              overflow: 'auto',
              marginBottom: 16,
            }}>
              {this.state.error.message}
            </pre>
          )}
          <button className="btn btn-primary" onClick={this.handleRetry}>
            <RefreshCw size={14} /> Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
