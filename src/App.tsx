import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import localforage from "localforage";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import AdminGuard from "@/components/AdminGuard";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { logClientError } from "@/lib/errorLog";
import { queryClient } from "@/lib/queryClient";
import Index from "./pages/Index.tsx";
import ApplyPage from "./pages/ApplyPage.tsx";
import JobsPage from "./pages/JobsPage.tsx";
import JobDetailPage from "./pages/JobDetailPage.tsx";
import TrainingPage from "./pages/TrainingPage.tsx";
import TrackApplicationPage from "./pages/TrackApplicationPage.tsx";
import AdminLoginPage from "./pages/AdminLoginPage.tsx";
import AdminVerifyPage from "./pages/AdminVerifyPage.tsx";
import ForgotPasswordPage from "./pages/ForgotPasswordPage.tsx";
import ResetPasswordPage from "./pages/ResetPasswordPage.tsx";
import DashboardPage from "./pages/DashboardPage.tsx";
import HrFormsShell from "./pages/HrForms/HrFormsShell.tsx";
import ExecutiveRecruitmentPage from "./pages/ExecutiveRecruitmentPage.tsx";
import ClientPortalLoginPage from "./pages/ClientPortalLoginPage.tsx";
import ClientPortalPage from "./pages/ClientPortalPage.tsx";
import ClientPortalGuard from "@/components/ClientPortal/ClientPortalGuard";
import NotFound from "./pages/NotFound.tsx";
import { useEffect } from "react";
import { loadUIStyles, applyUIStyles } from "@/components/Dashboard/UIStylingSettings";
import { DeletePinProvider } from "@/components/DeletePinDialog";

// App version used to invalidate the persisted cache on deploy, so a stale
// shape never survives a release (bump alongside meaningful schema changes).
const CACHE_BUSTER = "v1";

// IndexedDB persister — no size limit (unlike localStorage's 5 MB cap),
// async so large cache writes never block the main thread.
localforage.config({ name: "akg", storeName: "query-cache" });
const persister = createAsyncStoragePersister({
  storage: localforage,
  key: "akg-query-cache",
});

const UIStylesLoader = () => {
  useEffect(() => {
    loadUIStyles().then(applyUIStyles);
  }, []);
  return null;
};

const GlobalErrorListener = () => {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      logClientError({
        severity: "critical",
        source: "client",
        message: event.message || "Uncaught error",
        stack: event.error?.stack ?? null,
        context: { filename: event.filename, lineno: event.lineno },
      });
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      logClientError({
        severity: "error",
        source: "client",
        message: reason instanceof Error ? reason.message : String(reason),
        stack: reason instanceof Error ? reason.stack : null,
        context: { unhandledRejection: true },
      });
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
};

const App = () => (
  <PersistQueryClientProvider
    client={queryClient}
    persistOptions={{
      persister,
      maxAge: 24 * 60 * 60 * 1000,
      buster: CACHE_BUSTER,
      dehydrateOptions: {
        shouldDehydrateQuery: (query) => query.meta?.persist !== false,
      },
    }}
  >
    <ErrorBoundary>
      <BrowserRouter>
        <ThemeProvider>
          <LanguageProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <UIStylesLoader />
              <GlobalErrorListener />
              <DeletePinProvider>
              <Routes>
                {/* Public applicant-facing routes */}
                <Route path="/" element={<Index />} />
                <Route path="/apply" element={<ApplyPage />} />
                <Route path="/jobs" element={<JobsPage />} />
                <Route path="/jobs/:id" element={<JobDetailPage />} />
                <Route path="/training" element={<TrainingPage />} />
                <Route path="/track" element={<TrackApplicationPage />} />
                <Route path="/executive/recruitment/:token" element={<ExecutiveRecruitmentPage />} />

                {/* HR / Admin routes */}
                <Route path="/admin/login" element={<AdminLoginPage />} />
                <Route path="/admin/verify" element={<AdminVerifyPage />} />
                <Route path="/admin/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/admin/reset-password" element={<ResetPasswordPage />} />
                <Route path="/admin" element={<AdminGuard><DashboardPage /></AdminGuard>} />
                <Route path="/admin/hr-forms/*" element={<AdminGuard><HrFormsShell /></AdminGuard>} />

                {/* Legacy redirect */}
                <Route path="/dashboard" element={<AdminGuard><DashboardPage /></AdminGuard>} />

                {/* Client rental portal — separate auth/guard from the HR admin dashboard */}
                <Route path="/client-portal/login" element={<ClientPortalLoginPage />} />
                <Route path="/client-portal" element={<ClientPortalGuard><ClientPortalPage /></ClientPortalGuard>} />

                <Route path="*" element={<NotFound />} />
              </Routes>
              </DeletePinProvider>
            </TooltipProvider>
          </LanguageProvider>
        </ThemeProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </PersistQueryClientProvider>
);

export default App;
