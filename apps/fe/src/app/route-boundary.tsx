import { QueryErrorResetBoundary } from '@tanstack/react-query';
import { Component, Suspense, type ReactNode } from 'react';

import { ErrorFallback } from '@/components/feedback/error-fallback';
import { Spinner } from '@/components/feedback/spinner';

interface ErrorBoundaryProps {
  onReset: () => void;
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

class RouteErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  reset = () => {
    this.props.onReset(); // resets errored queries so retry actually refetches
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return <ErrorFallback onRetry={this.reset} />;
    }
    return this.props.children;
  }
}

/**
 * Standard non-happy-path surfaces for a route: Suspense fallback for
 * loading (suspense queries + lazy namespaces) and an error boundary wired
 * to TanStack Query reset for retry.
 */
export function RouteBoundary({ children }: { children: ReactNode }) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <RouteErrorBoundary onReset={reset}>
          <Suspense fallback={<Spinner />}>{children}</Suspense>
        </RouteErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}
