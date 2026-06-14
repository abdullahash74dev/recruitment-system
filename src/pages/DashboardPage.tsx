import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import TopBar from "@/components/TopBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Users, UserPlus, Phone, CheckCircle2, Download, LogOut, Search, Eye, BarChart3, Briefcase, FileText, ExternalLink, Plus, Pencil, Trash2, FolderOpen, Settings, Database, Archive, RotateCcw, Shield, Sparkles, Stethoscope } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import * as XLSX from "xlsx";
import SiteLogo from "@/components/SiteLogo";
import { MAX_INLINE_IMAGE_SIZE, readImageAsDataUrl } from "@/lib/imageUpload";
import { Link } from "react-router-dom";
import CustomQuestionsSettings from "@/components/Dashboard/CustomQuestionsSettings";
import StorageImage from "@/components/StorageImage";
import ProjectLogo from "@/components/ProjectLogo";
import { Slider } from "@/components/ui/slider";
import DropdownOptionsSettings from "@/components/Dashboard/DropdownOptionsSettings";
import BrandingSettings from "@/components/Dashboard/BrandingSettings";
import BackupSettings from "@/components/Dashboard/BackupSettings";
import ScheduledBackups from "@/components/Dashboard/ScheduledBackups";
import FormFieldsSettings from "@/components/Dashboard/FormFieldsSettings";
import SiteContentSettings from "@/components/Dashboard/SiteContentSettings";
import AnalyticsHub from "@/components/Dashboard/AnalyticsHub";
import ApplicantsImport from "@/components/Dashboard/ApplicantsImport";
import ApplicantsMappedImport from "@/components/Dashboard/ApplicantsMappedImport";
import UIStylingSettings from "@/components/Dashboard/UIStylingSettings";
import JobPageSettings from "@/components/Dashboard/JobPageSettings";
import DeletePinSettings from "@/components/Dashboard/DeletePinSettings";
import TwoFactorSettings from "@/components/Dashboard/TwoFactorSettings";
import JobsExcelTools from "@/components/Dashboard/JobsExcelTools";
import SystemLog from "@/components/Dashboard/SystemLog";
import TrashBin from "@/components/Dashboard/TrashBin";
import UserPermissionsDialog from "@/components/Dashboard/UserPermissionsDialog";
import RejectionReasonsSettings from "@/components/Dashboard/RejectionReasonsSettings";
import JobAdvertisements from "@/components/Dashboard/JobAdvertisements";
import RecruitmentDashboard from "@/components/Dashboard/Recruitment/RecruitmentDashboard";
import ApplicantEmailDialog from "@/components/Dashboard/ApplicantEmailDialog";
import ApplicantEmailHistory from "@/components/Dashboard/ApplicantEmailHistory";
import TransferToRecruitmentDialog from "@/components/Dashboard/TransferToRecruitmentDialog";
import ApplicantsAdvancedFilters, { AdvancedFilter, applyAdvancedFilters } from "@/components/Dashboard/ApplicantsAdvancedFilters";
import { Checkbox } from "@/components/ui/checkbox";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import AiSystemDoctor from "@/components/Dashboard/AiSystemDoctor";
import { AiUsageMonitor } from "@/components/Dashboard/AiUsageMonitor";
import AiProviderSettings from "@/components/Dashboard/AiProviderSettings";
import AiInsightsPanel from "@/components/Dashboard/AiInsightsPanel";
import NotificationsBell from "@/components/Dashboard/NotificationsBell";
import ExecutiveKPIs from "@/components/Dashboard/ExecutiveKPIs";
import ScheduledReports from "@/components/Dashboard/ScheduledReports";
import ReportBuilder from "@/components/Dashboard/ReportBuilder";
import SynonymsManager from "@/components/Dashboard/SynonymsManager";
import JobCategoriesManager from "@/components/Dashboard/JobCategoriesManager";
import { useDeletePin } from "@/components/DeletePinDialog";
import AINetworkBackground from "@/components/AINetworkBackground";
import AuroraBackground from "@/components/AuroraBackground";
import type { ApplicantEmailStatus } from "@/lib/applicantEmailTemplates";
import { STATUSES_WITH_EMAIL } from "@/lib/applicantEmailTemplates";
import { Mail, Activity, Bot, UserCog, Target, Globe, Menu, Palette, ListChecks } from "lucide-react";
import DashboardSidebar, { type DashboardNavGroup } from "@/components/Dashboard/DashboardSidebar";
import DashboardSidebarFuturistic from "@/components/Dashboard/DashboardSidebarFuturistic";
import { useTheme } from "@/contexts/ThemeContext";

type ApplicantStatus = "new" | "reviewing" | "phone_interview" | "in_person_interview" | "accepted" | "hired" | "rejected" | "withdrawn";

interface Applicant {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  desired_position: string | null;
  preferred_city: string | null;
  status: ApplicantStatus;
  notes: string | null;
  created_at: string;
  gender: string | null;
  nationality: string | null;
  education_level: string | null;
  years_experience: string | null;
  current_salary: string | null;
  expected_salary: string | null;
  job_type: string | null;
  major: string | null;
  university: string | null;
  current_title: string | null;
  linkedin: string | null;
  arabic_level: string | null;
  english_level: string | null;
  available_date: string | null;
  birth_date: string | null;
  marital_status: string | null;
  has_transport: string | null;
  current_city: string | null;
  dependents: number | null;
  gpa: string | null;
  graduation_year: string | null;
  self_summary: string | null;
  current_tasks: string | null;
  other_experience: string | null;
  other_language: string | null;
  hear_about: string | null;
  currently_employed: string | null;
  currently_studying: string | null;
  current_study: string | null;
  resume_url: string | null;
  degree_url: string | null;
  experience_cert_url: string | null;
  training_certs_url: string | null;
  other_docs_url: string | null;
  is_archived: boolean;
  archived_at: string | null;
  source?: string | null;
  source_company?: string | null;
}

interface JobPosting {
  id: string;
  title_ar: string;
  title_en: string | null;
  description_ar: string | null;
  description_en: string | null;
  location: string;
  location_en: string | null;
  job_type: string;
  job_type_en: string | null;
  department: string | null;
  department_en: string | null;
  requirements_ar: string | null;
  requirements_en: string | null;
  is_active: boolean;
  nationality_required: string | null;
  nationality_required_en: string | null;
  vacancy_count: number;
  created_at: string;
}

const STATUSES: ApplicantStatus[] = ["new", "reviewing", "phone_interview", "in_person_interview", "accepted", "hired", "rejected", "withdrawn"];
const ROLES = ["admin", "hr_manager", "recruitment_coordinator", "project_manager"] as const;

const STATUS_COLORS: Record<ApplicantStatus, string> = {
  new: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  reviewing: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  phone_interview: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  in_person_interview: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  accepted: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  hired: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  withdrawn: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

const CHART_COLORS = ["#3b82f6", "#eab308", "#a855f7", "#6366f1", "#22c55e", "#10b981", "#ef4444", "#6b7280"];

const DashboardPage = () => {
  const { t, dir, lang } = useLanguage();
  const { navStyle } = useTheme();
  const { permissions, hasPermission, role: currentUserRole, loading: permsLoading } = useUserPermissions();
  const { requestDelete } = useDeletePin();
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [jobsSearch, setJobsSearch] = useState("");
  const [usersSearch, setUsersSearch] = useState("");
  const [projectsSearch, setProjectsSearch] = useState("");
  const [advFilters, setAdvFilters] = useState<AdvancedFilter[]>([]);
  const [aiSelectedIds, setAiSelectedIds] = useState<Set<string> | null>(null);
  const [aiSummary, setAiSummary] = useState("");
  const [selectedApplicant, setSelectedApplicant] = useState<Applicant | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [activeTab, setActiveTab] = useState("applicants");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem("akg-sidebar-collapsed") === "true"; }
    catch { return false; }
  });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    try { localStorage.setItem("akg-sidebar-collapsed", String(sidebarCollapsed)); }
    catch { /* ignore */ }
  }, [sidebarCollapsed]);

  // Job form state
  const [showJobForm, setShowJobForm] = useState(false);
  const [editingJob, setEditingJob] = useState<JobPosting | null>(null);
  const [jobForm, setJobForm] = useState({
    title_ar: "", title_en: "", description_ar: "", description_en: "",
    location: "الرياض، المملكة العربية السعودية", location_en: "Riyadh, Saudi Arabia",
    job_type: "دوام كامل", job_type_en: "Full-time",
    department: "", department_en: "", requirements_ar: "", requirements_en: "",
    is_active: true, nationality_required: "", nationality_required_en: "", vacancy_count: 1,
    experience_required_ar: "", experience_required_en: "",
    degree_required_ar: "", degree_required_en: "",
    additional_details_ar: "", additional_details_en: "",
  });

  // User form state
  const [showUserForm, setShowUserForm] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserRole, setNewUserRole] = useState<string>("recruitment_coordinator");
  const [users, setUsers] = useState<any[]>([]);
  const [userRoles, setUserRoles] = useState<any[]>([]);

  // Permissions dialog state
  const [permDialogUser, setPermDialogUser] = useState<{ id: string; name: string; role: string } | null>(null);

  // Project form state
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const emptyProjectForm = {
    name_ar: "", name_en: "", description_ar: "", description_en: "", logo_url: "",
    logo_height: 64, logo_width: null as number | null, logo_fit: "contain",
    logo_radius: 12, logo_rotation: 0, logo_padding: 0,
    logo_bg_color: "" as string, logo_shadow: false, logo_border: false,
  };
  const [projectForm, setProjectForm] = useState(emptyProjectForm);
  const [projects, setProjects] = useState<any[]>([]);

  // حوار إيميل المرشح (تأكيد + معاينة)
  const [emailDialog, setEmailDialog] = useState<{ applicantId: string; status: ApplicantEmailStatus } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showTransferDialog, setShowTransferDialog] = useState(false);

  useEffect(() => {
    fetchApplicants();
    fetchJobs();
    fetchProjects();
    fetchUsers();
  }, []);

  const fetchApplicants = async () => {
    const pageSize = 1000;
    const all: Applicant[] = [];
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabase
        .from("applicants")
        .select("*")
        .order("created_at", { ascending: false })
        .range(from, from + pageSize - 1);
      if (error) { toast.error(error.message); return; }
      all.push(...((data || []) as Applicant[]));
      if (!data || data.length < pageSize) break;
    }
    setApplicants(all);
  };

  const fetchJobs = async () => {
    const { data, error } = await supabase
      .from("job_postings")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setJobs(data as JobPosting[]);
  };

  const fetchProjects = async () => {
    const { data } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
    if (data) setProjects(data);
  };

  const fetchUsers = async () => {
    const { data: profilesData } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
    const { data: rolesData } = await supabase.from("user_roles").select("*");
    if (profilesData) setUsers(profilesData);
    if (rolesData) setUserRoles(rolesData);
  };

  const handleLogout = async () => {
    const { logAudit } = await import("@/lib/audit");
    await logAudit({ action: "LOGOUT", summary: "User logged out" });
    await supabase.auth.signOut();
    window.location.href = "/admin/login";
  };

  const updateStatus = async (id: string, status: ApplicantStatus) => {
    const { error } = await supabase.from("applicants").update({ status }).eq("id", id);
    if (!error) {
      setApplicants(prev => prev.map(a => a.id === id ? { ...a, status } : a));
      if (selectedApplicant?.id === id) setSelectedApplicant(prev => prev ? { ...prev, status } : null);
      toast.success(t("dash.updateStatus"));
      // إذا كانت الحالة تستدعي إيميل، افتح حوار التأكيد تلقائياً
      if ((STATUSES_WITH_EMAIL as string[]).includes(status)) {
        const a = applicants.find(x => x.id === id);
        if (a?.email) {
          setEmailDialog({ applicantId: id, status: status as ApplicantEmailStatus });
        }
      }
    }
  };

  const saveNotes = async (id: string) => {
    const { error } = await supabase.from("applicants").update({ notes: editNotes }).eq("id", id);
    if (!error) {
      setApplicants(prev => prev.map(a => a.id === id ? { ...a, notes: editNotes } : a));
      toast.success(t("dash.saveNotes"));
    }
  };

  const getFileUrl = (path: string | null) => {
    if (!path) return "";
    // Already a full URL or data URI
    if (path.startsWith("http") || path.startsWith("data:")) return path;
    // Build signed URL for private bucket paths
    return ""; // Will use async version below
  };

  const getSignedFileUrl = async (path: string): Promise<string> => {
    if (!path) return "";
    if (path.startsWith("http") || path.startsWith("data:")) return path;
    const { data } = await supabase.storage.from("resumes").createSignedUrl(path, 3600);
    return data?.signedUrl || "";
  };

  const exportExcel = () => {
    const rows = applicants.map(a => ({
      [t("dash.name")]: a.full_name,
      [t("field.email")]: a.email,
      [t("field.phone")]: a.phone,
      [t("field.gender")]: a.gender,
      [t("field.nationality")]: a.nationality,
      [t("field.birthDate")]: a.birth_date,
      [t("field.maritalStatus")]: a.marital_status,
      [t("field.dependents")]: a.dependents,
      [t("field.currentCity")]: a.current_city,
      [t("field.hasTransport")]: a.has_transport,
      [t("dash.position")]: a.desired_position,
      [t("field.jobType")]: a.job_type,
      [t("dash.city")]: a.preferred_city,
      [t("field.hearAbout")]: a.hear_about,
      [t("field.educationLevel")]: a.education_level,
      [t("field.major")]: a.major,
      [t("field.university")]: a.university,
      [t("field.graduationYear")]: a.graduation_year,
      [t("field.gpa")]: a.gpa,
      [t("field.currentlyStudying")]: a.currently_studying,
      [t("field.currentStudy")]: a.current_study,
      [t("field.yearsExperience")]: a.years_experience,
      [t("field.currentlyEmployed")]: a.currently_employed,
      [t("field.currentTitle")]: a.current_title,
      [t("field.currentTasks")]: a.current_tasks,
      [t("field.selfSummary")]: a.self_summary,
      [t("field.otherExperience")]: a.other_experience,
      [t("field.arabicLevel")]: a.arabic_level,
      [t("field.englishLevel")]: a.english_level,
      [t("field.otherLanguage")]: a.other_language,
      [t("field.linkedin")]: a.linkedin,
      [t("field.currentSalary")]: a.current_salary,
      [t("field.expectedSalary")]: a.expected_salary,
      [t("field.availableDate")]: a.available_date,
      [t("dash.status")]: t(`status.${a.status}`),
      [t("dash.date")]: new Date(a.created_at).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US"),
      [t("dash.notes")]: a.notes,
      [t("field.resume")]: getFileUrl(a.resume_url),
      [t("field.degreeCopy")]: getFileUrl(a.degree_url),
      [t("field.experienceCert")]: getFileUrl(a.experience_cert_url),
      [t("field.trainingCerts")]: getFileUrl(a.training_certs_url),
      [t("field.otherDocs")]: getFileUrl(a.other_docs_url),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, t("dash.applicants"));
    XLSX.writeFile(wb, `applicants_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  // Job CRUD
  const openJobForm = (job?: JobPosting) => {
    if (job) {
      setEditingJob(job);
      setJobForm({
        title_ar: job.title_ar,
        title_en: job.title_en || "",
        description_ar: job.description_ar || "",
        description_en: job.description_en || "",
        location: job.location,
        location_en: (job as any).location_en || "",
        job_type: job.job_type,
        job_type_en: (job as any).job_type_en || "",
        department: job.department || "",
        department_en: (job as any).department_en || "",
        requirements_ar: job.requirements_ar || "",
        requirements_en: job.requirements_en || "",
        is_active: job.is_active,
        nationality_required: job.nationality_required || "",
        nationality_required_en: (job as any).nationality_required_en || "",
        vacancy_count: (job as any).vacancy_count || 1,
        experience_required_ar: (job as any).experience_required_ar || "",
        experience_required_en: (job as any).experience_required_en || "",
        degree_required_ar: (job as any).degree_required_ar || "",
        degree_required_en: (job as any).degree_required_en || "",
        additional_details_ar: (job as any).additional_details_ar || "",
        additional_details_en: (job as any).additional_details_en || "",
      });
    } else {
      setEditingJob(null);
      setJobForm({
        title_ar: "", title_en: "", description_ar: "", description_en: "",
        location: "الرياض، المملكة العربية السعودية", location_en: "Riyadh, Saudi Arabia",
        job_type: "دوام كامل", job_type_en: "Full-time",
        department: "", department_en: "", requirements_ar: "", requirements_en: "",
        is_active: true, nationality_required: "", nationality_required_en: "", vacancy_count: 1,
        experience_required_ar: "", experience_required_en: "",
        degree_required_ar: "", degree_required_en: "",
        additional_details_ar: "", additional_details_en: "",
      });
    }
    setShowJobForm(true);
  };

  const saveJob = async () => {
    if (!jobForm.title_ar) { toast.error(t("validation.required")); return; }
    const payload = {
      title_ar: jobForm.title_ar,
      title_en: jobForm.title_en || null,
      description_ar: jobForm.description_ar || null,
      description_en: jobForm.description_en || null,
      location: jobForm.location,
      location_en: jobForm.location_en || null,
      job_type: jobForm.job_type,
      job_type_en: jobForm.job_type_en || null,
      department: jobForm.department || null,
      department_en: jobForm.department_en || null,
      requirements_ar: jobForm.requirements_ar || null,
      requirements_en: jobForm.requirements_en || null,
      is_active: jobForm.is_active,
      nationality_required: jobForm.nationality_required || null,
      nationality_required_en: jobForm.nationality_required_en || null,
      vacancy_count: jobForm.vacancy_count || 1,
      experience_required_ar: jobForm.experience_required_ar || null,
      experience_required_en: jobForm.experience_required_en || null,
      degree_required_ar: jobForm.degree_required_ar || null,
      degree_required_en: jobForm.degree_required_en || null,
      additional_details_ar: jobForm.additional_details_ar || null,
      additional_details_en: jobForm.additional_details_en || null,
    };

    if (editingJob) {
      const { error } = await supabase.from("job_postings").update(payload).eq("id", editingJob.id);
      if (!error) { toast.success(t("dash.saved")); fetchJobs(); setShowJobForm(false); }
    } else {
      const { error } = await supabase.from("job_postings").insert(payload);
      if (!error) { toast.success(t("dash.saved")); fetchJobs(); setShowJobForm(false); }
    }
  };

  const deleteJob = (id: string) => {
    requestDelete({
      message: lang === "ar" ? "سيتم حذف هذه الوظيفة نهائياً." : "This job will be permanently deleted.",
      onConfirm: async () => {
        const { error } = await supabase.from("job_postings").delete().eq("id", id);
        if (!error) { toast.success(t("dash.deleted")); fetchJobs(); }
        else toast.error(error.message);
      },
    });
  };

  const toggleJobActive = async (id: string, active: boolean) => {
    const { error } = await supabase.from("job_postings").update({ is_active: active }).eq("id", id);
    if (!error) { fetchJobs(); toast.success(t("dash.saved")); }
  };

  const callManageUser = async (body: any) => {
    const { data: { session: s } } = await supabase.auth.getSession();
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-user`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          ...(s?.access_token ? { Authorization: `Bearer ${s.access_token}` } : {}),
        },
        body: JSON.stringify(body),
      }
    );
    return res.json();
  };

  const addUser = async () => {
    if (!newUserEmail || !newUserPassword) { toast.error(t("validation.required")); return; }
    const result = await callManageUser({
      action: "create_user",
      email: newUserEmail,
      password: newUserPassword,
      role: newUserRole,
      display_name: newUserName || newUserEmail,
    });
    if (result.error) { toast.error(result.error); return; }
    toast.success(t("dash.userAdded"));
    setShowUserForm(false);
    setNewUserEmail("");
    setNewUserPassword("");
    setNewUserName("");
    fetchUsers();
  };

  const updateUserRole = async (userId: string, role: string) => {
    const result = await callManageUser({ action: "update_role", user_id: userId, role });
    if (result.error) { toast.error(result.error); return; }
    toast.success(t("dash.roleUpdated"));
    fetchUsers();
  };

  const toggleUserActive = async (userId: string, isActive: boolean) => {
    const result = await callManageUser({ action: "toggle_active", user_id: userId, is_active: isActive });
    if (result.error) { toast.error(result.error); return; }
    toast.success(t("dash.statusUpdated"));
    fetchUsers();
  };

  const deleteUser = (userId: string) => {
    requestDelete({
      message: lang === "ar" ? "سيتم حذف هذا المستخدم نهائياً." : "This user will be permanently deleted.",
      onConfirm: async () => {
        const result = await callManageUser({ action: "delete_user", user_id: userId });
        if (result.error) { toast.error(result.error); return; }
        toast.success(t("dash.userDeleted"));
        fetchUsers();
      },
    });
  };

  // Project management
  const saveProject = async () => {
    if (!projectForm.name_ar) { toast.error(t("validation.required")); return; }
    const payload = {
      name_ar: projectForm.name_ar,
      name_en: projectForm.name_en || null,
      description_ar: projectForm.description_ar || null,
      description_en: projectForm.description_en || null,
      logo_url: projectForm.logo_url || null,
      logo_height: projectForm.logo_height,
      logo_width: projectForm.logo_width,
      logo_fit: projectForm.logo_fit,
      logo_radius: projectForm.logo_radius,
      logo_rotation: projectForm.logo_rotation,
      logo_padding: projectForm.logo_padding,
      logo_bg_color: projectForm.logo_bg_color || null,
      logo_shadow: projectForm.logo_shadow,
      logo_border: projectForm.logo_border,
    };
    const { error } = editingProjectId
      ? await supabase.from("projects").update(payload).eq("id", editingProjectId)
      : await supabase.from("projects").insert(payload);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(t("dash.saved"));
    fetchProjects();
    setShowProjectForm(false);
    setEditingProjectId(null);
    setProjectForm(emptyProjectForm);
  };

  const activeApplicants = applicants.filter(a => !a.is_archived);
  const archivedApplicants = applicants.filter(a => a.is_archived);

  const filtered = applyAdvancedFilters(
    activeApplicants.filter(a => {
      const matchSearch = a.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (a.desired_position || "").toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = filterStatus === "all" || a.status === filterStatus;
      return matchSearch && matchStatus;
    }),
    advFilters,
    aiSelectedIds,
  );

  const filteredArchived = archivedApplicants.filter(a => {
    const matchSearch = a.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (a.desired_position || "").toLowerCase().includes(searchTerm.toLowerCase());
    return matchSearch;
  });

  const archiveApplicant = async (id: string) => {
    if (!confirm(lang === "ar" ? "هل تريد أرشفة هذا المتقدم؟" : "Archive this applicant?")) return;
    const { error } = await supabase.from("applicants").update({ is_archived: true, archived_at: new Date().toISOString() }).eq("id", id);
    if (!error) {
      setApplicants(prev => prev.map(a => a.id === id ? { ...a, is_archived: true, archived_at: new Date().toISOString() } : a));
      setSelectedApplicant(null);
      toast.success(lang === "ar" ? "تم الأرشفة بنجاح" : "Archived successfully");
    }
  };

  const restoreApplicant = async (id: string) => {
    const { error } = await supabase.from("applicants").update({ is_archived: false, archived_at: null }).eq("id", id);
    if (!error) {
      setApplicants(prev => prev.map(a => a.id === id ? { ...a, is_archived: false, archived_at: null } : a));
      toast.success(lang === "ar" ? "تمت الاستعادة بنجاح" : "Restored successfully");
    }
  };

  // Chart data
  const statusData = STATUSES.map((s, i) => ({
    name: t(`status.${s}`), value: activeApplicants.filter(a => a.status === s).length, fill: CHART_COLORS[i],
  })).filter(d => d.value > 0);

  const positionData = Object.entries(
    activeApplicants.reduce((acc, a) => { const pos = a.desired_position || "N/A"; acc[pos] = (acc[pos] || 0) + 1; return acc; }, {} as Record<string, number>)
  ).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, value]) => ({ name: name.substring(0, 20), value }));

  const monthlyData = (() => {
    const months: Record<string, number> = {};
    activeApplicants.forEach(a => { const m = new Date(a.created_at).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US", { month: "short", year: "numeric" }); months[m] = (months[m] || 0) + 1; });
    return Object.entries(months).map(([name, value]) => ({ name, value })).reverse().slice(0, 12).reverse();
  })();


  const stats = [
    { label: t("dash.totalApplicants"), value: activeApplicants.length, icon: Users, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: t("dash.newApplicants"), value: activeApplicants.filter(a => a.status === "new").length, icon: UserPlus, color: "text-yellow-500", bg: "bg-yellow-500/10" },
    { label: t("dash.inInterview"), value: activeApplicants.filter(a => ["phone_interview", "in_person_interview"].includes(a.status)).length, icon: Phone, color: "text-purple-500", bg: "bg-purple-500/10" },
    { label: t("dash.hired"), value: activeApplicants.filter(a => a.status === "hired").length, icon: CheckCircle2, color: "text-green-500", bg: "bg-green-500/10" },
  ];

  // Search filters for Jobs / Users / Projects tabs
  const filteredJobs = jobs.filter(job => {
    const q = jobsSearch.trim().toLowerCase();
    if (!q) return true;
    return [job.title_ar, (job as any).title_en, job.location, (job as any).location_en]
      .some(v => (v || "").toLowerCase().includes(q));
  });

  const filteredUsers = users.filter((user: any) => {
    const q = usersSearch.trim().toLowerCase();
    if (!q) return true;
    return [user.display_name, user.email].some((v: string) => (v || "").toLowerCase().includes(q));
  });

  const filteredProjects = projects.filter((p: any) => {
    const q = projectsSearch.trim().toLowerCase();
    if (!q) return true;
    return [p.name_ar, p.name_en].some((v: string) => (v || "").toLowerCase().includes(q));
  });

  const isAdmin = currentUserRole === "admin";

  // Build the sidebar navigation, grouped and gated by permissions
  const tabAllowed = (key: string) => isAdmin || hasPermission(key as any);
  const navGroups: DashboardNavGroup[] = [];

  const applicantsItems: DashboardNavGroup["items"] = [];
  if (tabAllowed("tab.applicants")) {
    applicantsItems.push({ value: "applicants", label: t("dash.tab.applicants"), icon: Users });
    applicantsItems.push({ value: "archive", label: lang === "ar" ? "الأرشيف" : "Archive", icon: Archive, badge: archivedApplicants.length || undefined });
  }
  if (applicantsItems.length) navGroups.push({ id: "applicants", title: lang === "ar" ? "المتقدمون" : "Applicants", items: applicantsItems });

  const recruitmentItems: DashboardNavGroup["items"] = [];
  if (tabAllowed("tab.jobs")) recruitmentItems.push({ value: "jobs", label: t("dash.tab.jobs"), icon: Briefcase });
  if (tabAllowed("tab.job_ads")) recruitmentItems.push({ value: "job_ads", label: lang === "ar" ? "إعلانات الوظائف" : "Job Ads", icon: Sparkles });
  if (tabAllowed("tab.recruitment")) recruitmentItems.push({ value: "recruitment", label: lang === "ar" ? "إدارة التوظيف" : "Recruitment", icon: Target });
  if (tabAllowed("tab.rejection_reasons")) recruitmentItems.push({ value: "rejection_reasons", label: lang === "ar" ? "أسباب الرفض" : "Rejection Reasons", icon: Mail });
  if (tabAllowed("tab.jobpage")) recruitmentItems.push({ value: "jobpage", label: lang === "ar" ? "صفحة الوظائف" : "Job Page", icon: Globe });
  if (recruitmentItems.length) navGroups.push({ id: "recruitment", title: lang === "ar" ? "التوظيف" : "Recruitment", items: recruitmentItems });

  const managementItems: DashboardNavGroup["items"] = [];
  if (tabAllowed("tab.projects")) managementItems.push({ value: "projects", label: t("dash.tab.projects"), icon: FolderOpen });
  if (tabAllowed("tab.users")) managementItems.push({ value: "users", label: t("dash.tab.users"), icon: UserCog });
  if (tabAllowed("tab.analytics")) managementItems.push({ value: "analytics", label: t("dash.tab.analytics"), icon: BarChart3 });
  if (managementItems.length) navGroups.push({ id: "management", title: lang === "ar" ? "الإدارة" : "Management", items: managementItems });

  const aiItems: DashboardNavGroup["items"] = [];
  if (tabAllowed("tab.ai_doctor")) aiItems.push({ value: "ai_doctor", label: lang === "ar" ? "طبيب النظام" : "AI Doctor", icon: Stethoscope });
  if (tabAllowed("tab.ai_usage")) aiItems.push({ value: "ai_usage", label: lang === "ar" ? "استهلاك الذكاء" : "AI Usage", icon: Activity });
  if (tabAllowed("tab.ai_settings")) aiItems.push({ value: "ai_settings", label: lang === "ar" ? "إعدادات الذكاء" : "AI Settings", icon: Bot });
  if (aiItems.length) navGroups.push({ id: "ai", title: lang === "ar" ? "الذكاء الاصطناعي" : "AI Tools", items: aiItems });

  const systemItems: DashboardNavGroup["items"] = [];
  if (tabAllowed("tab.settings")) systemItems.push({ value: "settings", label: t("dash.tab.settings"), icon: Settings });
  if (tabAllowed("tab.backup")) systemItems.push({ value: "backup", label: lang === "ar" ? "نسخ احتياطي" : "Backup", icon: Database });
  if (tabAllowed("tab.auditlog")) systemItems.push({ value: "auditlog", label: lang === "ar" ? "سجل النظام" : "System Log", icon: Shield });
  if (tabAllowed("tab.trash")) systemItems.push({ value: "trash", label: lang === "ar" ? "سلة المحذوفات" : "Trash", icon: Trash2 });
  if (systemItems.length) navGroups.push({ id: "system", title: lang === "ar" ? "النظام" : "System", items: systemItems });

  const flatNavItems = navGroups.flatMap((g) => g.items);
  const showSidebar = navStyle !== "classic";
  const sidebarProps = {
    groups: navGroups,
    activeTab,
    onChange: setActiveTab,
    collapsed: sidebarCollapsed,
    onToggleCollapsed: () => setSidebarCollapsed((v) => !v),
    mobileOpen: mobileNavOpen,
    onCloseMobile: () => setMobileNavOpen(false),
    dir,
    title: t("dash.title"),
    collapseLabel: lang === "ar" ? "طي القائمة" : "Collapse",
    expandLabel: lang === "ar" ? "توسيع القائمة" : "Expand",
  };

  return (
    <div className="min-h-screen bg-background relative flex" dir={dir}>
      <AuroraBackground />
      {navStyle === "modern" && <DashboardSidebar {...sidebarProps} />}
      {navStyle === "futuristic" && <DashboardSidebarFuturistic {...sidebarProps} />}
      <div className="flex-1 min-w-0 flex flex-col">
      {/* Header */}
      <header className="gradient-hero py-4 px-6 sticky top-0 z-30 border-b border-white/10 shadow-elevated relative overflow-hidden">
        <AINetworkBackground className="opacity-40" />
        <div
          className="absolute inset-0 pointer-events-none opacity-60"
          style={{ background: "radial-gradient(circle at 15% 30%, hsl(var(--accent) / 0.25), transparent 55%)" }}
        />
        <div className="max-w-7xl mx-auto flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3 md:gap-4">
            {showSidebar && (
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                className="md:hidden p-2 rounded-lg text-primary-foreground hover:bg-white/10"
                aria-label={lang === "ar" ? "فتح القائمة" : "Open menu"}
              >
                <Menu className="w-5 h-5" />
              </button>
            )}
            <Link to="/"><SiteLogo heightOverride={40} /></Link>
            <div className="hidden md:flex items-center gap-2">
              <h1 className="text-primary-foreground font-bold text-lg">{t("dash.title")}</h1>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-accent bg-white/10 border border-white/15 rounded-full px-2.5 py-1 backdrop-blur-sm shadow-glow animate-scale-in">
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                AI
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <TopBar variant="light" allowCustomization />
            <NotificationsBell />
            <Link to="/jobs">
              <Button variant="ghost" className="text-primary-foreground hover:bg-white/10 gap-2">
                <Briefcase className="w-4 h-4" /><span className="hidden md:inline">{t("nav.jobs")}</span>
              </Button>
            </Link>
            <Button variant="ghost" onClick={handleLogout} className="text-primary-foreground hover:bg-white/10 gap-2">
              <LogOut className="w-4 h-4" /><span className="hidden md:inline">{t("dash.logout")}</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto w-full p-4 md:p-6 space-y-6">
        {/* Stats — only on the Applicants tab; Recruitment & Analytics have their own dedicated KPI sections */}
        {activeTab === "applicants" && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats.map((stat, i) => (
              <Card key={i} className="group overflow-hidden hover:shadow-elevated hover:-translate-y-0.5">
                <CardContent className="p-4 md:p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-muted-foreground text-xs md:text-sm font-medium">{stat.label}</p>
                      <p className="text-2xl md:text-3xl font-bold mt-1 tracking-tight">{stat.value}</p>
                    </div>
                    <div className={`w-12 h-12 md:w-14 md:h-14 rounded-2xl ${stat.bg} flex items-center justify-center transition-transform duration-300 group-hover:scale-110`}>
                      <stat.icon className={`w-6 h-6 md:w-7 md:h-7 ${stat.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          {navStyle === "classic" && (
            <TabsList className="flex flex-wrap w-full h-auto gap-1.5 p-1.5 bg-muted/60 backdrop-blur-sm border border-border/50 rounded-xl justify-start shadow-sm">
              {flatNavItems.map((item) => (
                <TabsTrigger
                  key={item.value}
                  value={item.value}
                  className="h-9 px-4 text-sm font-medium rounded-lg flex items-center gap-1.5 transition-all duration-300 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-md hover:text-foreground"
                >
                  <item.icon className="w-3.5 h-3.5" />
                  {item.label}
                  {!!item.badge && <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 ms-1">{item.badge}</Badge>}
                </TabsTrigger>
              ))}
            </TabsList>
          )}
          {/* APPLICANTS TAB */}
          <TabsContent value="applicants">
            {isAdmin && <div className="mb-3 space-y-2"><ApplicantsImport onChanged={fetchApplicants} /><ApplicantsMappedImport onChanged={fetchApplicants} /></div>}
            <ApplicantsAdvancedFilters
              applicants={activeApplicants}
              lang={lang}
              filters={advFilters}
              setFilters={setAdvFilters}
              aiSelectedIds={aiSelectedIds}
              setAiSelectedIds={setAiSelectedIds}
              aiSummary={aiSummary}
              setAiSummary={setAiSummary}
            />
            <Card>
              <CardHeader className="pb-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <CardTitle className="flex items-center gap-2"><Users className="w-5 h-5" />{t("dash.applicants")}</CardTitle>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative">
                      <Search className="absolute top-2.5 w-4 h-4 text-muted-foreground" style={{ [dir === "rtl" ? "right" : "left"]: "0.75rem" }} />
                      <Input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder={t("dash.search")} className="w-full sm:w-64" style={{ [dir === "rtl" ? "paddingRight" : "paddingLeft"]: "2.5rem" }} />
                    </div>
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder={t("dash.filterStatus")} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t("dash.all")}</SelectItem>
                        {STATUSES.map(s => <SelectItem key={s} value={s}>{t(`status.${s}`)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button onClick={exportExcel} variant="outline" className="gap-2"><Download className="w-4 h-4" />{t("dash.export")}</Button>
                    {selectedIds.size > 0 && (
                      <Button onClick={() => setShowTransferDialog(true)} className="gap-2 gradient-accent text-accent-foreground">
                        <Briefcase className="w-4 h-4" />{lang === "ar" ? `نقل (${selectedIds.size}) إلى التوظيف` : `Transfer (${selectedIds.size}) to Recruitment`}
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">
                          <Checkbox
                            checked={filtered.length > 0 && filtered.every(a => selectedIds.has(a.id))}
                            onCheckedChange={(v) => {
                              const s = new Set(selectedIds);
                              if (v) filtered.forEach(a => s.add(a.id));
                              else filtered.forEach(a => s.delete(a.id));
                              setSelectedIds(s);
                            }}
                          />
                        </TableHead>
                        <TableHead>{t("dash.name")}</TableHead>
                        <TableHead>{t("dash.position")}</TableHead>
                        <TableHead>{t("dash.city")}</TableHead>
                        <TableHead>{t("dash.status")}</TableHead>
                        <TableHead>{t("dash.date")}</TableHead>
                        <TableHead>{t("dash.actions")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.length === 0 ? (
                        <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{t("dash.search")}</TableCell></TableRow>
                      ) : filtered.map(a => (
                        <TableRow key={a.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setSelectedApplicant(a); setEditNotes(a.notes || ""); }}>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedIds.has(a.id)}
                              onCheckedChange={(v) => {
                                const s = new Set(selectedIds);
                                if (v) s.add(a.id); else s.delete(a.id);
                                setSelectedIds(s);
                              }}
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span>{a.full_name}</span>
                              {a.source === "external" && (
                                <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30" title={a.source_company || ""}>
                                  📦 خارجي{a.source_company ? ` · ${a.source_company}` : ""}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{a.desired_position}</TableCell>
                          <TableCell>{a.preferred_city}</TableCell>
                          <TableCell><Badge className={`${STATUS_COLORS[a.status]} border-0`}>{t(`status.${a.status}`)}</Badge></TableCell>
                          <TableCell className="text-sm text-muted-foreground">{new Date(a.created_at).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US")}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setSelectedApplicant(a); setEditNotes(a.notes || ""); }}><Eye className="w-4 h-4" /></Button>
                              <Button size="sm" variant="ghost" className="text-destructive" onClick={(e) => { e.stopPropagation(); archiveApplicant(a.id); }}><Archive className="w-4 h-4" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ARCHIVE TAB */}
          <TabsContent value="archive">
            <Card>
              <CardHeader className="pb-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <CardTitle className="flex items-center gap-2"><Archive className="w-5 h-5" />{lang === "ar" ? "الأرشيف" : "Archive"} ({archivedApplicants.length})</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {filteredArchived.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Archive className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>{lang === "ar" ? "لا توجد سجلات مؤرشفة" : "No archived records"}</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("dash.name")}</TableHead>
                          <TableHead>{t("dash.position")}</TableHead>
                          <TableHead>{t("dash.status")}</TableHead>
                          <TableHead>{lang === "ar" ? "تاريخ الأرشفة" : "Archived At"}</TableHead>
                          <TableHead>{t("dash.actions")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredArchived.map(a => (
                          <TableRow key={a.id}>
                            <TableCell className="font-medium">{a.full_name}</TableCell>
                            <TableCell>{a.desired_position}</TableCell>
                            <TableCell><Badge className={`${STATUS_COLORS[a.status]} border-0`}>{t(`status.${a.status}`)}</Badge></TableCell>
                            <TableCell className="text-sm text-muted-foreground">{a.archived_at ? new Date(a.archived_at).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US") : "-"}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button size="sm" variant="ghost" onClick={() => { setSelectedApplicant(a); setEditNotes(a.notes || ""); }}><Eye className="w-4 h-4" /></Button>
                                <Button size="sm" variant="outline" className="gap-1 text-primary" onClick={() => restoreApplicant(a.id)}><RotateCcw className="w-4 h-4" />{lang === "ar" ? "استعادة" : "Restore"}</Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="jobs">
            <Card>
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <CardTitle className="flex items-center gap-2"><Briefcase className="w-5 h-5" />{t("dash.manageJobs")}</CardTitle>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative">
                      <Search className="absolute top-2.5 w-4 h-4 text-muted-foreground" style={{ [dir === "rtl" ? "right" : "left"]: "0.75rem" }} />
                      <Input value={jobsSearch} onChange={e => setJobsSearch(e.target.value)} placeholder={t("dash.search")} className="w-full sm:w-64" style={{ [dir === "rtl" ? "paddingRight" : "paddingLeft"]: "2.5rem" }} />
                    </div>
                    <Button onClick={() => openJobForm()} className="gradient-accent text-accent-foreground gap-2"><Plus className="w-4 h-4" />{t("dash.addJob")}</Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <JobsExcelTools jobs={jobs} onChanged={fetchJobs} />
                {filteredJobs.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-8">{lang === "ar" ? "لا توجد وظائف مطابقة" : "No matching jobs"}</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("dash.jobTitle")}</TableHead>
                          <TableHead>{t("dash.jobLocation")}</TableHead>
                          <TableHead>{t("dash.jobType")}</TableHead>
                          <TableHead>{t("dash.status")}</TableHead>
                          <TableHead>{t("dash.actions")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredJobs.map(job => (
                          <TableRow key={job.id}>
                            <TableCell className="font-medium">{lang === "ar" ? job.title_ar : (job.title_en || job.title_ar)}</TableCell>
                            <TableCell>{lang === "ar" ? job.location : ((job as any).location_en || job.location)}</TableCell>
                            <TableCell>{lang === "ar" ? job.job_type : ((job as any).job_type_en || job.job_type)}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Switch checked={job.is_active} onCheckedChange={(v) => toggleJobActive(job.id, v)} />
                                <span className="text-xs">{job.is_active ? t("dash.jobActive") : t("dash.jobInactive")}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button size="sm" variant="ghost" onClick={() => openJobForm(job)}><Pencil className="w-4 h-4" /></Button>
                                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteJob(job.id)}><Trash2 className="w-4 h-4" /></Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users">
            <Card>
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <CardTitle className="flex items-center gap-2"><Users className="w-5 h-5" />{t("dash.manageUsers")}</CardTitle>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative">
                      <Search className="absolute top-2.5 w-4 h-4 text-muted-foreground" style={{ [dir === "rtl" ? "right" : "left"]: "0.75rem" }} />
                      <Input value={usersSearch} onChange={e => setUsersSearch(e.target.value)} placeholder={t("dash.search")} className="w-full sm:w-64" style={{ [dir === "rtl" ? "paddingRight" : "paddingLeft"]: "2.5rem" }} />
                    </div>
                    <Button onClick={() => setShowUserForm(true)} className="gradient-accent text-accent-foreground gap-2"><Plus className="w-4 h-4" />{t("dash.addUser")}</Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {filteredUsers.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-8">{users.length === 0 ? t("dash.noUsers") : (lang === "ar" ? "لا يوجد مستخدمون مطابقون" : "No matching users")}</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("dash.userName")}</TableHead>
                          <TableHead>{t("dash.userEmail")}</TableHead>
                          <TableHead>{t("dash.userRole")}</TableHead>
                          <TableHead>{t("dash.userStatus")}</TableHead>
                          <TableHead>{t("dash.actions")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredUsers.map((user: any) => {
                          const userRole = userRoles.find((r: any) => r.user_id === user.user_id);
                          const isCurrentUser = false; // handled by AdminGuard
                          return (
                            <TableRow key={user.id}>
                              <TableCell className="font-medium">{user.display_name || user.email}</TableCell>
                              <TableCell dir="ltr" className="text-sm">{user.email}</TableCell>
                              <TableCell>
                                <Select
                                  value={userRole?.role || ""}
                                  onValueChange={(v) => updateUserRole(user.user_id, v)}
                                  disabled={isCurrentUser}
                                >
                                  <SelectTrigger className="w-40"><SelectValue placeholder="-" /></SelectTrigger>
                                  <SelectContent>
                                    {ROLES.map(r => <SelectItem key={r} value={r}>{t(`role.${r}`)}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Switch
                                    checked={user.is_active !== false}
                                    onCheckedChange={(v) => toggleUserActive(user.user_id, v)}
                                    disabled={isCurrentUser}
                                  />
                                  <span className="text-xs">
                                    {user.is_active !== false ? t("dash.userActive") : t("dash.userInactive")}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  {!isCurrentUser && (
                                    <>
                                      <Button size="sm" variant="ghost" onClick={() => setPermDialogUser({ id: user.user_id, name: user.display_name || user.email, role: userRole?.role || "" })}>
                                        <Shield className="w-4 h-4" />
                                      </Button>
                                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteUser(user.user_id)}>
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* PROJECTS TAB */}
          <TabsContent value="projects">
            <Card>
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <CardTitle className="flex items-center gap-2"><FolderOpen className="w-5 h-5" />{t("dash.projects")}</CardTitle>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative">
                      <Search className="absolute top-2.5 w-4 h-4 text-muted-foreground" style={{ [dir === "rtl" ? "right" : "left"]: "0.75rem" }} />
                      <Input value={projectsSearch} onChange={e => setProjectsSearch(e.target.value)} placeholder={t("dash.search")} className="w-full sm:w-64" style={{ [dir === "rtl" ? "paddingRight" : "paddingLeft"]: "2.5rem" }} />
                    </div>
                    <Button onClick={() => { setEditingProjectId(null); setProjectForm(emptyProjectForm); setShowProjectForm(true); }} className="gradient-accent text-accent-foreground gap-2"><Plus className="w-4 h-4" />{t("dash.addProject")}</Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {filteredProjects.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-8">{projects.length === 0 ? (lang === "ar" ? "لا توجد مشاريع بعد" : "No projects yet") : (lang === "ar" ? "لا توجد مشاريع مطابقة" : "No matching projects")}</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                     {filteredProjects.map((p: any) => (
                      <Card key={p.id}>
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3 mb-2">
                            <ProjectLogo
                              path={p.logo_url}
                              alt={p.name_ar}
                              height={Math.min(p.logo_height || 64, 56)}
                              fit={p.logo_fit}
                              radius={p.logo_radius}
                              rotation={p.logo_rotation}
                              padding={p.logo_padding}
                              bgColor={p.logo_bg_color}
                              shadow={p.logo_shadow}
                              border={p.logo_border}
                              fallbackClassName=""
                            />
                            <h3 className="font-bold">{lang === "ar" ? p.name_ar : (p.name_en || p.name_ar)}</h3>
                          </div>
                          {p.description_ar && <p className="text-muted-foreground text-sm mt-1 line-clamp-2">{lang === "ar" ? p.description_ar : (p.description_en || p.description_ar)}</p>}
                          <div className="flex items-center justify-between mt-3">
                            <Badge variant={p.is_active ? "default" : "secondary"}>{p.is_active ? t("dash.jobActive") : t("dash.jobInactive")}</Badge>
                            <div className="flex gap-1">
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => {
                                setEditingProjectId(p.id);
                                setProjectForm({
                                  name_ar: p.name_ar,
                                  name_en: p.name_en || "",
                                  description_ar: p.description_ar || "",
                                  description_en: p.description_en || "",
                                  logo_url: p.logo_url || "",
                                  logo_height: p.logo_height ?? 64,
                                  logo_width: p.logo_width ?? null,
                                  logo_fit: p.logo_fit ?? "contain",
                                  logo_radius: p.logo_radius ?? 12,
                                  logo_rotation: p.logo_rotation ?? 0,
                                  logo_padding: p.logo_padding ?? 0,
                                  logo_bg_color: p.logo_bg_color ?? "",
                                  logo_shadow: !!p.logo_shadow,
                                  logo_border: !!p.logo_border,
                                });
                                setShowProjectForm(true);
                              }}>
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={async () => {
                                await supabase.from("projects").update({ is_active: !p.is_active }).eq("id", p.id);
                                fetchProjects();
                              }}>
                                <Eye className="w-3.5 h-3.5" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => {
                                requestDelete({
                                  message: lang === "ar" ? "سيتم حذف هذا المشروع نهائياً." : "This project will be permanently deleted.",
                                  onConfirm: async () => {
                                    const { error } = await supabase.from("projects").delete().eq("id", p.id);
                                    if (error) { toast.error(error.message); return; }
                                    fetchProjects();
                                    toast.success(lang === "ar" ? "تم الحذف" : "Deleted");
                                  },
                                });
                              }}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ANALYTICS TAB */}
          <TabsContent value="analytics" className="space-y-6">
            <AiInsightsPanel />
            <ExecutiveKPIs />
            <ReportBuilder />
            <SynonymsManager />
            <ScheduledReports />
            <AnalyticsHub applicants={activeApplicants as any} jobs={jobs as any} />
          </TabsContent>

          {/* SETTINGS TAB */}
          <TabsContent value="settings">
            <Tabs defaultValue="appearance">
              <TabsList className="flex flex-wrap h-auto gap-1.5">
                <TabsTrigger value="appearance" className="gap-1.5">
                  <Palette className="w-3.5 h-3.5" />{lang === "ar" ? "المظهر والعلامة التجارية" : "Appearance & Branding"}
                </TabsTrigger>
                <TabsTrigger value="content" className="gap-1.5">
                  <Globe className="w-3.5 h-3.5" />{lang === "ar" ? "محتوى الموقع" : "Site Content"}
                </TabsTrigger>
                <TabsTrigger value="forms" className="gap-1.5">
                  <ListChecks className="w-3.5 h-3.5" />{lang === "ar" ? "النماذج والحقول" : "Forms & Fields"}
                </TabsTrigger>
                <TabsTrigger value="security" className="gap-1.5">
                  <Shield className="w-3.5 h-3.5" />{lang === "ar" ? "الأمان" : "Security"}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="appearance" className="space-y-6 mt-4">
                <Card>
                  <CardContent className="p-6">
                    <BrandingSettings />
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6">
                    <UIStylingSettings />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="content" className="space-y-6 mt-4">
                <Card>
                  <CardContent className="p-6">
                    <SiteContentSettings />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="forms" className="space-y-6 mt-4">
                <Card>
                  <CardContent className="p-6">
                    <FormFieldsSettings />
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6">
                    <CustomQuestionsSettings />
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6">
                    <DropdownOptionsSettings />
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6">
                    <JobCategoriesManager />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="security" className="space-y-6 mt-4">
                <Card className="border-destructive/40">
                  <CardContent className="p-6">
                    <DeletePinSettings />
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6">
                    <TwoFactorSettings />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* JOB PAGE SETTINGS TAB */}
          <TabsContent value="jobpage">
            <Card>
              <CardContent className="p-6">
                <JobPageSettings />
              </CardContent>
            </Card>
          </TabsContent>


          <TabsContent value="backup" className="space-y-6">
            <ScheduledBackups />
            <Card>
              <CardContent className="p-6">
                <BackupSettings />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="auditlog">
            <SystemLog />
          </TabsContent>

          <TabsContent value="rejection_reasons">
            <RejectionReasonsSettings />
          </TabsContent>

          <TabsContent value="job_ads">
            <JobAdvertisements />
          </TabsContent>

          <TabsContent value="trash">
            <TrashBin />
          </TabsContent>

          <TabsContent value="recruitment">
            <RecruitmentDashboard />
          </TabsContent>

          <TabsContent value="ai_doctor">
            <AiSystemDoctor />
          </TabsContent>

          <TabsContent value="ai_usage">
            <AiUsageMonitor lang={lang} />
          </TabsContent>

          <TabsContent value="ai_settings">
            <AiProviderSettings />
          </TabsContent>
        </Tabs>
      </main>
      </div>

      {/* Applicant Detail Dialog */}
      <Dialog open={!!selectedApplicant} onOpenChange={() => setSelectedApplicant(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir={dir}>
          {selectedApplicant && (
            <>
              <DialogHeader><DialogTitle className="text-xl">{selectedApplicant.full_name}</DialogTitle></DialogHeader>
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t("dash.updateStatus")}</label>
                  <Select value={selectedApplicant.status} onValueChange={(v) => updateStatus(selectedApplicant.id, v as ApplicantStatus)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{t(`status.${s}`)}</SelectItem>)}</SelectContent>
                  </Select>
                  {(STATUSES_WITH_EMAIL as string[]).includes(selectedApplicant.status) && selectedApplicant.email && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => setEmailDialog({ applicantId: selectedApplicant.id, status: selectedApplicant.status as ApplicantEmailStatus })}
                    >
                      <Mail className="w-4 h-4" />
                      {lang === "ar" ? "إرسال إيميل للمرشح" : "Send email to candidate"}
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {([
                    ["field.email", selectedApplicant.email],
                    ["field.phone", selectedApplicant.phone],
                    ["field.gender", selectedApplicant.gender],
                    ["field.nationality", selectedApplicant.nationality],
                    ["field.birthDate", selectedApplicant.birth_date],
                    ["field.maritalStatus", selectedApplicant.marital_status],
                    ["field.currentCity", selectedApplicant.current_city],
                    ["field.hasTransport", selectedApplicant.has_transport],
                    ["field.jobType", selectedApplicant.job_type],
                    ["field.educationLevel", selectedApplicant.education_level],
                    ["field.major", selectedApplicant.major],
                    ["field.university", selectedApplicant.university],
                    ["field.graduationYear", selectedApplicant.graduation_year],
                    ["field.gpa", selectedApplicant.gpa],
                    ["field.yearsExperience", selectedApplicant.years_experience],
                    ["field.currentlyEmployed", selectedApplicant.currently_employed],
                    ["field.currentTitle", selectedApplicant.current_title],
                    ["field.arabicLevel", selectedApplicant.arabic_level],
                    ["field.englishLevel", selectedApplicant.english_level],
                    ["field.otherLanguage", selectedApplicant.other_language],
                    ["field.currentSalary", selectedApplicant.current_salary],
                    ["field.expectedSalary", selectedApplicant.expected_salary],
                    ["field.availableDate", selectedApplicant.available_date],
                    ["field.hearAbout", selectedApplicant.hear_about],
                    ["field.facilityManagementExp", (selectedApplicant as any).facility_management_exp],
                  ] as [string, string | null][]).filter(([, val]) => val).map(([key, val]) => (
                    <div key={key} className="border border-border rounded-lg p-2">
                      <p className="text-muted-foreground text-xs">{t(key)}</p>
                      <p className="font-medium">{val}</p>
                    </div>
                  ))}
                </div>

                {selectedApplicant.linkedin && (
                  <div className="border border-border rounded-lg p-2">
                    <p className="text-muted-foreground text-xs">{t("field.linkedin")}</p>
                    {(() => {
                      const url = selectedApplicant.linkedin || "";
                      const safe = /^https?:\/\//i.test(url);
                      return safe ? (
                        <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline text-sm">{url}</a>
                      ) : (
                        <span className="text-sm text-muted-foreground break-all">{url}</span>
                      );
                    })()}
                  </div>
                )}

                {selectedApplicant.self_summary && (
                  <div className="border border-border rounded-lg p-3">
                    <p className="text-muted-foreground text-xs mb-1">{t("field.selfSummary")}</p>
                    <p className="text-sm">{selectedApplicant.self_summary}</p>
                  </div>
                )}

                {selectedApplicant.current_tasks && (
                  <div className="border border-border rounded-lg p-3">
                    <p className="text-muted-foreground text-xs mb-1">{t("field.currentTasks")}</p>
                    <p className="text-sm">{selectedApplicant.current_tasks}</p>
                  </div>
                )}

                {selectedApplicant.other_experience && (
                  <div className="border border-border rounded-lg p-3">
                    <p className="text-muted-foreground text-xs mb-1">{t("field.otherExperience")}</p>
                    <p className="text-sm">{selectedApplicant.other_experience}</p>
                  </div>
                )}

                {/* Attachments */}
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2"><FileText className="w-4 h-4" />{t("dash.attachments")}</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {([
                      ["field.resume", selectedApplicant.resume_url],
                      ["field.degreeCopy", selectedApplicant.degree_url],
                      ["field.experienceCert", selectedApplicant.experience_cert_url],
                      ["field.trainingCerts", selectedApplicant.training_certs_url],
                      ["field.otherDocs", selectedApplicant.other_docs_url],
                    ] as [string, string | null][]).filter(([, val]) => val).map(([key, val]) => (
                      <button key={key} onClick={async () => {
                        const v = (val || "").trim();
                        if (/^https?:\/\//i.test(v)) { window.open(v, "_blank"); return; }
                        const { data } = await supabase.storage.from("resumes").createSignedUrl(v, 3600);
                        if (data?.signedUrl) window.open(data.signedUrl, "_blank");
                        else toast.error("Could not open file");
                      }} className="flex items-center gap-2 border border-border rounded-lg p-2 hover:bg-muted/50 transition-colors text-sm cursor-pointer">
                        <ExternalLink className="w-4 h-4 text-primary shrink-0" />
                        <span className="truncate">{t(key)}</span>
                      </button>
                    ))}
                    {![selectedApplicant.resume_url, selectedApplicant.degree_url, selectedApplicant.experience_cert_url, selectedApplicant.training_certs_url, selectedApplicant.other_docs_url].some(Boolean) && (
                      <p className="text-muted-foreground text-xs col-span-2">{t("dash.noAttachments")}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">{t("dash.notes")}</label>
                  <Textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={3} />
                  <Button size="sm" onClick={() => saveNotes(selectedApplicant.id)} className="gradient-accent text-accent-foreground">{t("dash.saveNotes")}</Button>
                  {!selectedApplicant.is_archived ? (
                    <Button size="sm" variant="outline" className="gap-1 text-destructive border-destructive/30" onClick={() => archiveApplicant(selectedApplicant.id)}>
                      <Archive className="w-4 h-4" />{lang === "ar" ? "أرشفة" : "Archive"}
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" className="gap-1 text-primary" onClick={() => restoreApplicant(selectedApplicant.id)}>
                      <RotateCcw className="w-4 h-4" />{lang === "ar" ? "استعادة" : "Restore"}
                    </Button>
                  )}
                </div>

                <ApplicantEmailHistory applicantId={selectedApplicant.id} />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* حوار تأكيد إرسال إيميل للمرشح */}
      {emailDialog && (() => {
        const a = applicants.find(x => x.id === emailDialog.applicantId);
        if (!a) return null;
        return (
          <ApplicantEmailDialog
            open={!!emailDialog}
            onOpenChange={(v) => { if (!v) setEmailDialog(null); }}
            applicantId={a.id}
            applicantName={a.full_name}
            applicantEmail={a.email}
            applicantLanguage={lang as "ar" | "en"}
            positionAr={a.desired_position}
            positionEn={a.desired_position}
            status={emailDialog.status}
          />
        );
      })()}

      {showTransferDialog && (
        <TransferToRecruitmentDialog
          applicants={applicants.filter(a => selectedIds.has(a.id))}
          onClose={() => setShowTransferDialog(false)}
          onTransferred={() => setSelectedIds(new Set())}
        />
      )}

      {/* Job Form Dialog */}
      <Dialog open={showJobForm} onOpenChange={setShowJobForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir={dir}>
          <DialogHeader><DialogTitle>{editingJob ? t("dash.editJob") : t("dash.addJob")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("dash.jobTitle")} *</Label>
                <Input value={jobForm.title_ar} onChange={e => setJobForm(p => ({ ...p, title_ar: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>{t("dash.jobTitleEn")}</Label>
                <Input value={jobForm.title_en} onChange={e => setJobForm(p => ({ ...p, title_en: e.target.value }))} dir="ltr" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("dash.jobLocation")} ({t("dash.arabic")})</Label>
                <Input value={jobForm.location} onChange={e => setJobForm(p => ({ ...p, location: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>{t("dash.jobLocation")} ({t("dash.english")})</Label>
                <Input value={jobForm.location_en} onChange={e => setJobForm(p => ({ ...p, location_en: e.target.value }))} dir="ltr" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("dash.jobType")} ({t("dash.arabic")})</Label>
                <Input value={jobForm.job_type} onChange={e => setJobForm(p => ({ ...p, job_type: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>{t("dash.jobType")} ({t("dash.english")})</Label>
                <Input value={jobForm.job_type_en} onChange={e => setJobForm(p => ({ ...p, job_type_en: e.target.value }))} dir="ltr" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("dash.jobDept")} ({t("dash.arabic")})</Label>
                <Input value={jobForm.department} onChange={e => setJobForm(p => ({ ...p, department: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>{t("dash.jobDept")} ({t("dash.english")})</Label>
                <Input value={jobForm.department_en} onChange={e => setJobForm(p => ({ ...p, department_en: e.target.value }))} dir="ltr" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("dash.nationalityRequired")} ({t("dash.arabic")})</Label>
                <Input value={jobForm.nationality_required} onChange={e => setJobForm(p => ({ ...p, nationality_required: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>{t("dash.nationalityRequired")} ({t("dash.english")})</Label>
                <Input value={jobForm.nationality_required_en} onChange={e => setJobForm(p => ({ ...p, nationality_required_en: e.target.value }))} dir="ltr" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("dash.jobDesc")}</Label>
              <Textarea value={jobForm.description_ar} onChange={e => setJobForm(p => ({ ...p, description_ar: e.target.value }))} rows={3} />
            </div>
            <div className="space-y-2">
              <Label>{t("dash.jobDescEn")}</Label>
              <Textarea value={jobForm.description_en} onChange={e => setJobForm(p => ({ ...p, description_en: e.target.value }))} rows={3} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>{t("dash.jobReq")}</Label>
              <Textarea value={jobForm.requirements_ar} onChange={e => setJobForm(p => ({ ...p, requirements_ar: e.target.value }))} rows={3} />
            </div>
            <div className="space-y-2">
              <Label>{t("dash.jobReqEn")}</Label>
              <Textarea value={jobForm.requirements_en} onChange={e => setJobForm(p => ({ ...p, requirements_en: e.target.value }))} rows={3} dir="ltr" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("jobDetail.experienceRequired")} ({t("dash.arabic")})</Label>
                <Input value={jobForm.experience_required_ar} onChange={e => setJobForm(p => ({ ...p, experience_required_ar: e.target.value }))} placeholder={lang === "ar" ? "مثال: 3 سنوات" : "e.g. 3 years"} />
              </div>
              <div className="space-y-2">
                <Label>{t("jobDetail.experienceRequired")} ({t("dash.english")})</Label>
                <Input value={jobForm.experience_required_en} onChange={e => setJobForm(p => ({ ...p, experience_required_en: e.target.value }))} dir="ltr" placeholder="e.g. 3 years" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("jobDetail.degreeRequired")} ({t("dash.arabic")})</Label>
                <Input value={jobForm.degree_required_ar} onChange={e => setJobForm(p => ({ ...p, degree_required_ar: e.target.value }))} placeholder={lang === "ar" ? "مثال: بكالوريوس هندسة" : "e.g. B.Sc Engineering"} />
              </div>
              <div className="space-y-2">
                <Label>{t("jobDetail.degreeRequired")} ({t("dash.english")})</Label>
                <Input value={jobForm.degree_required_en} onChange={e => setJobForm(p => ({ ...p, degree_required_en: e.target.value }))} dir="ltr" placeholder="e.g. B.Sc Engineering" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("jobDetail.additionalDetails")} ({t("dash.arabic")})</Label>
              <Textarea value={jobForm.additional_details_ar} onChange={e => setJobForm(p => ({ ...p, additional_details_ar: e.target.value }))} rows={3} />
            </div>
            <div className="space-y-2">
              <Label>{t("jobDetail.additionalDetails")} ({t("dash.english")})</Label>
              <Textarea value={jobForm.additional_details_en} onChange={e => setJobForm(p => ({ ...p, additional_details_en: e.target.value }))} rows={3} dir="ltr" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("dash.vacancyCount")}</Label>
                <Input type="number" min={1} value={jobForm.vacancy_count} onChange={e => setJobForm(p => ({ ...p, vacancy_count: parseInt(e.target.value) || 1 }))} />
              </div>
              <div className="flex items-center gap-3 pt-6">
                <Switch checked={jobForm.is_active} onCheckedChange={v => setJobForm(p => ({ ...p, is_active: v }))} />
                <Label>{jobForm.is_active ? t("dash.jobActive") : t("dash.jobInactive")}</Label>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setShowJobForm(false)}>{t("dash.cancel")}</Button>
              <Button onClick={saveJob} className="gradient-accent text-accent-foreground">{t("dash.save")}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showUserForm} onOpenChange={setShowUserForm}>
        <DialogContent dir={dir}>
          <DialogHeader><DialogTitle>{t("dash.addUser")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("dash.displayName")}</Label>
              <Input value={newUserName} onChange={e => setNewUserName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t("dash.signupEmail")}</Label>
              <Input value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} type="email" dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>{t("dash.signupPassword")}</Label>
              <Input value={newUserPassword} onChange={e => setNewUserPassword(e.target.value)} type="password" dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>{t("dash.role")}</Label>
              <Select value={newUserRole} onValueChange={setNewUserRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map(r => <SelectItem key={r} value={r}>{t(`role.${r}`)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setShowUserForm(false)}>{t("dash.cancel")}</Button>
              <Button onClick={addUser} className="gradient-accent text-accent-foreground">{t("dash.save")}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Project Form Dialog */}
      <Dialog open={showProjectForm} onOpenChange={(open) => { setShowProjectForm(open); if (!open) setEditingProjectId(null); }}>
        <DialogContent
          dir={dir}
          className="top-2 bottom-2 flex w-[calc(100vw-1rem)] max-w-2xl -translate-y-0 flex-col overflow-hidden p-0 sm:bottom-auto sm:top-[50%] sm:max-h-[90dvh] sm:translate-y-[-50%]"
        >
          <DialogHeader className="shrink-0 border-b px-4 py-4 sm:px-6">
            <DialogTitle>{editingProjectId ? (lang === "ar" ? "تعديل المشروع" : "Edit Project") : t("dash.addProject")}</DialogTitle>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
            <div className="space-y-4 pb-4">
              <div className="space-y-2">
                <Label>{t("dash.projectName")} *</Label>
                <Input value={projectForm.name_ar} onChange={e => setProjectForm(p => ({ ...p, name_ar: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>{t("dash.projectNameEn")}</Label>
                <Input value={projectForm.name_en} onChange={e => setProjectForm(p => ({ ...p, name_en: e.target.value }))} dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label>{t("dash.projectDesc")} ({t("dash.arabic")})</Label>
                <Textarea value={projectForm.description_ar} onChange={e => setProjectForm(p => ({ ...p, description_ar: e.target.value }))} rows={2} />
              </div>
              <div className="space-y-2">
                <Label>{t("dash.projectDesc")} ({t("dash.english")})</Label>
                <Textarea value={projectForm.description_en} onChange={e => setProjectForm(p => ({ ...p, description_en: e.target.value }))} rows={2} dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label>{lang === "ar" ? "شعار المشروع" : "Project Logo"}</Label>
                <div className="space-y-2">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > MAX_INLINE_IMAGE_SIZE) {
                        toast.error(lang === "ar" ? "حجم الصورة كبير، اختر صورة أصغر من 4MB" : "Image is too large, choose one under 4MB");
                        return;
                      }

                      try {
                        const ext = (file.name.split(".").pop() || "png").toLowerCase();
                        const path = `${crypto.randomUUID()}.${ext}`;
                        const { error: upErr } = await supabase.storage.from("project-logos").upload(path, file, { contentType: file.type, upsert: false });
                        if (upErr) throw upErr;
                        const { data: pub } = supabase.storage.from("project-logos").getPublicUrl(path);
                        setProjectForm(p => ({ ...p, logo_url: pub.publicUrl }));
                        toast.success(lang === "ar" ? "تم رفع الشعار" : "Logo uploaded");
                      } catch {
                        toast.error(lang === "ar" ? "فشل رفع الشعار" : "Logo upload failed");
                      }
                    }}
                    className="cursor-pointer"
                  />
                  <p className="text-xs text-muted-foreground">{lang === "ar" ? "أو أدخل رابط مباشر:" : "Or enter a direct URL:"}</p>
                  <Input value={projectForm.logo_url} onChange={e => setProjectForm(p => ({ ...p, logo_url: e.target.value }))} dir="ltr" placeholder="https://..." />
                  {projectForm.logo_url && (
                    <div className="mt-2 rounded-md border bg-[hsl(var(--muted)/0.3)] p-4 flex items-center justify-center min-h-[140px]">
                      <ProjectLogo
                        path={projectForm.logo_url}
                        alt="Preview"
                        height={projectForm.logo_height}
                        width={projectForm.logo_width}
                        fit={projectForm.logo_fit}
                        radius={projectForm.logo_radius}
                        rotation={projectForm.logo_rotation}
                        padding={projectForm.logo_padding}
                        bgColor={projectForm.logo_bg_color}
                        shadow={projectForm.logo_shadow}
                        border={projectForm.logo_border}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Logo styling controls */}
              <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
                <h4 className="font-semibold text-sm">{lang === "ar" ? "تنسيق الشعار" : "Logo Styling"}</h4>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">{lang === "ar" ? `الارتفاع: ${projectForm.logo_height}px` : `Height: ${projectForm.logo_height}px`}</Label>
                    <Slider min={24} max={200} step={2} value={[projectForm.logo_height]}
                      onValueChange={([v]) => setProjectForm(p => ({ ...p, logo_height: v }))} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">{lang === "ar" ? `العرض: ${projectForm.logo_width ?? "تلقائي"}` : `Width: ${projectForm.logo_width ?? "auto"}`}</Label>
                    <Slider min={0} max={300} step={2} value={[projectForm.logo_width ?? 0]}
                      onValueChange={([v]) => setProjectForm(p => ({ ...p, logo_width: v === 0 ? null : v }))} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">{lang === "ar" ? `الزوايا: ${projectForm.logo_radius}px` : `Radius: ${projectForm.logo_radius}px`}</Label>
                    <Slider min={0} max={100} step={1} value={[projectForm.logo_radius]}
                      onValueChange={([v]) => setProjectForm(p => ({ ...p, logo_radius: v }))} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">{lang === "ar" ? `الحشوة: ${projectForm.logo_padding}px` : `Padding: ${projectForm.logo_padding}px`}</Label>
                    <Slider min={0} max={40} step={1} value={[projectForm.logo_padding]}
                      onValueChange={([v]) => setProjectForm(p => ({ ...p, logo_padding: v }))} />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label className="text-xs">{lang === "ar" ? `الدوران: ${projectForm.logo_rotation}°` : `Rotation: ${projectForm.logo_rotation}°`}</Label>
                    <Slider min={-180} max={180} step={1} value={[projectForm.logo_rotation]}
                      onValueChange={([v]) => setProjectForm(p => ({ ...p, logo_rotation: v }))} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">{lang === "ar" ? "طريقة العرض" : "Object Fit"}</Label>
                    <Select value={projectForm.logo_fit} onValueChange={(v) => setProjectForm(p => ({ ...p, logo_fit: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="contain">{lang === "ar" ? "احتواء" : "Contain"}</SelectItem>
                        <SelectItem value="cover">{lang === "ar" ? "تغطية" : "Cover"}</SelectItem>
                        <SelectItem value="fill">{lang === "ar" ? "ملء" : "Fill"}</SelectItem>
                        <SelectItem value="scale-down">{lang === "ar" ? "تصغير" : "Scale Down"}</SelectItem>
                        <SelectItem value="none">{lang === "ar" ? "بدون" : "None"}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">{lang === "ar" ? "لون الخلفية" : "Background Color"}</Label>
                    <div className="flex gap-2">
                      <Input type="color" value={projectForm.logo_bg_color || "#ffffff"}
                        onChange={e => setProjectForm(p => ({ ...p, logo_bg_color: e.target.value }))}
                        className="h-10 w-16 p-1 cursor-pointer" />
                      <Input value={projectForm.logo_bg_color} placeholder={lang === "ar" ? "شفاف" : "Transparent"}
                        onChange={e => setProjectForm(p => ({ ...p, logo_bg_color: e.target.value }))} dir="ltr" />
                      {projectForm.logo_bg_color && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => setProjectForm(p => ({ ...p, logo_bg_color: "" }))}>×</Button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <Switch checked={projectForm.logo_shadow}
                      onCheckedChange={(v) => setProjectForm(p => ({ ...p, logo_shadow: v }))} />
                    <Label className="text-xs">{lang === "ar" ? "ظل" : "Shadow"}</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={projectForm.logo_border}
                      onCheckedChange={(v) => setProjectForm(p => ({ ...p, logo_border: v }))} />
                    <Label className="text-xs">{lang === "ar" ? "إطار" : "Border"}</Label>
                  </div>
                  <Button type="button" variant="outline" size="sm" className="ms-auto"
                    onClick={() => setProjectForm(p => ({
                      ...p, logo_height: 64, logo_width: null, logo_fit: "contain",
                      logo_radius: 12, logo_rotation: 0, logo_padding: 0,
                      logo_bg_color: "", logo_shadow: false, logo_border: false,
                    }))}>
                    {lang === "ar" ? "إعادة ضبط" : "Reset"}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 justify-end gap-3 border-t bg-background px-4 py-4 sm:px-6">
            <Button variant="outline" onClick={() => setShowProjectForm(false)}>{t("dash.cancel")}</Button>
            <Button onClick={saveProject} className="gradient-accent text-accent-foreground">{t("dash.save")}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Permissions Dialog */}
      {permDialogUser && (
        <UserPermissionsDialog
          open={!!permDialogUser}
          onOpenChange={(open) => !open && setPermDialogUser(null)}
          userId={permDialogUser.id}
          userName={permDialogUser.name}
          userRole={permDialogUser.role}
        />
      )}
    </div>
  );
};

export default DashboardPage;
