import { Component } from 'react';

export class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <main className="empty-trace" role="alert">
          Something went wrong while loading EI-Nexus.
          <br />
          <button type="button" className="primary" onClick={() => window.location.reload()}>Retry</button>
        </main>
      );
    }
    return this.props.children;
  }
}
