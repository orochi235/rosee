import { LabRoot } from '@weasel-js/labkit';
import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  onReset(): void;
}

/** Catches a render that throws, so a bad state shows its error and a way
 *  out instead of a blank page. */
export class ErrorBoundary extends Component<Props, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <LabRoot mode="dark" className="rs-crash">
        <div role="alert">
          <p>The lab hit an error and stopped drawing:</p>
          <pre className="rs-error">{error.message}</pre>
          <button type="button" onClick={this.props.onReset}>
            Reset
          </button>
        </div>
      </LabRoot>
    );
  }
}
