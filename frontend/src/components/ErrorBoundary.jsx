import { Component } from "react";

/**
 * Catches any uncaught render error in the component tree so the user gets a helpful
 * error message and a way back home instead of an empty purple screen.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Uncaught render error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="center-page">
          <div className="panel sheet stack">
            <h1 className="display pane-title">Something went wrong</h1>
            <p className="notice notice-bad">
              {this.state.error?.message || "An unexpected error interrupted the game."}
            </p>
            <button
              className="btn btn-big btn-scream"
              onClick={() => {
                window.location.assign("/");
              }}
            >
              Back to Home
            </button>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}
