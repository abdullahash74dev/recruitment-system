import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import AdminGuard from "@/components/AdminGuard";
import Index from "./pages/Index.tsx";
import ApplyPage from "./pages/ApplyPage.tsx";
import JobsPage from "./pages/JobsPage.tsx";
import JobDetailPage from "./pages/JobDetailPage.tsx";
import TrainingPage from "./pages/TrainingPage.tsx";
import AdminLoginPage from "./pages/AdminLoginPage.tsx";
import AdminVerifyPage from "./pages/AdminVerifyPage.tsx";
import ForgotPasswordPage from "./pages/ForgotPasswordPage.tsx";
import ResetPasswordPage from "./pages/ResetPasswordPage.tsx";
import DashboardPage from "./pages/DashboardPage.tsx";
import ExecutiveRecruitmentPage from "./pages/ExecutiveRecruitmentPage.tsx";
import NotFound from "./pages/NotFound.tsx";
import { useEffect } from "react";
import { loadUIStyles, applyUIStyles } from "@/components/Dashboard/UIStylingSettings";
import { DeletePinProvider } from "@/components/DeletePinDialog";

const queryClient = new QueryClient();

const UIStylesLoader = () => {
  useEffect(() => {
    loadUIStyles().then(applyUIStyles);
  }, []);
  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <LanguageProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <UIStylesLoader />
          <BrowserRouter>
            <DeletePinProvider>
            <Routes>
              {/* Public applicant-facing routes */}
              <Route path="/" element={<Index />} />
              <Route path="/apply" element={<ApplyPage />} />
              <Route path="/jobs" element={<JobsPage />} />
              <Route path="/jobs/:id" element={<JobDetailPage />} />
              <Route path="/training" element={<TrainingPage />} />
              <Route path="/executive/recruitment/:token" element={<ExecutiveRecruitmentPage />} />

              {/* HR / Admin routes */}
              <Route path="/admin/login" element={<AdminLoginPage />} />
              <Route path="/admin/verify" element={<AdminVerifyPage />} />
              <Route path="/admin/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/admin/reset-password" element={<ResetPasswordPage />} />
              <Route path="/admin" element={<AdminGuard><DashboardPage /></AdminGuard>} />

              {/* Legacy redirect */}
              <Route path="/dashboard" element={<AdminGuard><DashboardPage /></AdminGuard>} />

              <Route path="*" element={<NotFound />} />
            </Routes>
            </DeletePinProvider>
          </BrowserRouter>
        </TooltipProvider>
      </LanguageProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
