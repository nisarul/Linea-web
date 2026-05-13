// SPDX-License-Identifier: AGPL-3.0-or-later
import { Component, type ErrorInfo, type ReactNode } from "react";
import { Card, CardBody, CardHeader } from "@/components";

interface State {
  error: Error | null;
}

/**
 * ErrorBoundary catches render-time errors below it and renders a
 * friendly recovery surface instead of a blank screen. Logs to
 * console for the developer.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Render error:", error, info);
  }

  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mx-auto max-w-xl py-16">
        <Card>
          <CardHeader>
            <h1 className="font-serif text-xl tracking-tight">
              Something broke.
            </h1>
          </CardHeader>
          <CardBody className="space-y-3 text-sm">
            <p className="text-(--color-fg-secondary)">
              An unexpected error stopped this page from rendering. The error
              has been logged to the browser console.
            </p>
            <pre className="overflow-auto rounded-md bg-(--color-bg-sunken) p-3 text-xs">
              {String(this.state.error.message || this.state.error)}
            </pre>
            <button
              onClick={() => window.location.reload()}
              className="text-sm font-medium text-(--color-accent) hover:underline"
            >
              Reload page
            </button>
          </CardBody>
        </Card>
      </div>
    );
  }
}
