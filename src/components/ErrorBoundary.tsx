import { Component, ErrorInfo, ReactNode } from "react";
import { logClientError } from "@/lib/errorLog";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logClientError({
      severity: "critical",
      source: "client",
      message: error.message || "Unhandled render error",
      stack: error.stack ?? info.componentStack ?? null,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center" dir="rtl">
          <h1 className="text-xl font-semibold">حدث خطأ غير متوقع</h1>
          <p className="text-muted-foreground">تم تسجيل المشكلة تلقائيًا. حاول تحديث الصفحة.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-md bg-primary px-4 py-2 text-primary-foreground"
          >
            تحديث الصفحة
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
