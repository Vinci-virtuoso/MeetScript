import * as React from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { reportClientError } from "@/lib/report-error";

interface Props {
  component: string;
  children: React.ReactNode;
}
interface State {
  failed: boolean;
}

/** Catches a render error in an island, reports it once, and offers a reload. */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error): void {
    reportClientError({ message: error.message.slice(0, 500), stack: (error.stack ?? "").slice(0, 4000), component: this.props.component });
  }

  render(): React.ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <Alert variant="destructive">
        <AlertTitle>This part of the page stopped working.</AlertTitle>
        <AlertDescription>
          <p>The problem was recorded. Reload the page to continue.</p>
          <Button variant="outline" onClick={() => location.reload()}>
            Reload
          </Button>
        </AlertDescription>
      </Alert>
    );
  }
}
