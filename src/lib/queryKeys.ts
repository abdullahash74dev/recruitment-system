/**
 * Central query key factory. Every cached entity gets its keys defined here so
 * invalidation across hooks/components stays consistent and typo-proof.
 */
export const queryKeys = {
  applicants: {
    all: ["applicants"] as const,
    list: (filters?: Record<string, unknown>) => ["applicants", "list", filters ?? {}] as const,
    customAnswers: (applicantIds: string[]) => ["applicants", "customAnswers", applicantIds] as const,
  },
  jobPostings: {
    all: ["jobPostings"] as const,
    list: () => ["jobPostings", "list"] as const,
  },
  jobAdvertisements: {
    all: ["jobAdvertisements"] as const,
    list: () => ["jobAdvertisements", "list"] as const,
  },
  jobCategories: {
    all: ["jobCategories"] as const,
    list: () => ["jobCategories", "list"] as const,
    titleCategories: () => ["jobCategories", "titleCategories"] as const,
  },
  projects: {
    all: ["projects"] as const,
    list: () => ["projects", "list"] as const,
  },
  profiles: {
    all: ["profiles"] as const,
    list: () => ["profiles", "list"] as const,
  },
  userRoles: {
    all: ["userRoles"] as const,
    list: () => ["userRoles", "list"] as const,
    permissions: (userId?: string) => ["userRoles", "permissions", userId] as const,
    // Raw permission_key/granted override rows for a target user (admin edit
    // dialog) — distinct shape from `permissions()`, which returns the merged
    // effective permission set for the CURRENT session user only.
    permissionOverrides: (userId: string) => ["userRoles", "permissionOverrides", userId] as const,
  },
  auditLog: {
    all: ["auditLog"] as const,
    list: () => ["auditLog", "list"] as const,
  },
  aiUsage: {
    log: () => ["aiUsage", "log"] as const,
    settings: () => ["aiUsage", "settings"] as const,
  },
  backupRuns: {
    all: ["backupRuns"] as const,
    list: () => ["backupRuns", "list"] as const,
  },
  recruitmentCandidates: {
    all: ["recruitmentCandidates"] as const,
    list: (projectId?: string) => ["recruitmentCandidates", "list", projectId] as const,
  },
  recruitmentProjects: {
    all: ["recruitmentProjects"] as const,
    list: () => ["recruitmentProjects", "list"] as const,
  },
  recruitmentJobTitles: {
    all: ["recruitmentJobTitles"] as const,
    list: () => ["recruitmentJobTitles", "list"] as const,
    // recruitment_job_title_stats is a DB view derived from this table —
    // nested under the same key prefix so one invalidation covers both.
    stats: () => ["recruitmentJobTitles", "stats"] as const,
  },
  rejectionReasons: {
    all: ["rejectionReasons"] as const,
    list: () => ["rejectionReasons", "list"] as const,
  },
  executiveShareLinks: {
    all: ["executiveShareLinks"] as const,
    list: () => ["executiveShareLinks", "list"] as const,
  },
  valueSynonyms: {
    all: ["valueSynonyms"] as const,
    list: () => ["valueSynonyms", "list"] as const,
  },
  savedFilters: {
    all: ["savedFilters"] as const,
    list: () => ["savedFilters", "list"] as const,
  },
  dropdownOptions: {
    all: ["dropdownOptions"] as const,
    list: (field?: string) => ["dropdownOptions", "list", field] as const,
    // Unfiltered (incl. inactive rows + id) shape used by the admin editor —
    // distinct from `all` (active-only, no id) used by the public form fields.
    adminAll: ["dropdownOptions", "adminAll"] as const,
  },
  fieldConfig: {
    all: ["fieldConfig"] as const,
    list: () => ["fieldConfig", "list"] as const,
  },
  customQuestions: {
    all: ["customQuestions"] as const,
  },
  siteSettings: {
    all: ["siteSettings"] as const,
  },
  dashboardPreferences: {
    all: ["dashboardPreferences"] as const,
    forUser: (userId?: string) => ["dashboardPreferences", userId] as const,
  },
  notifications: {
    all: ["notifications"] as const,
    list: () => ["notifications", "list"] as const,
  },
  reportTemplates: {
    all: ["reportTemplates"] as const,
    list: () => ["reportTemplates", "list"] as const,
    runs: () => ["reportTemplates", "runs"] as const,
  },
  scheduledReports: {
    all: ["scheduledReports"] as const,
    list: () => ["scheduledReports", "list"] as const,
  },
  interviews: {
    all: ["interviews"] as const,
    list: () => ["interviews", "list"] as const,
  },
  deletedItems: {
    all: ["deletedItems"] as const,
    list: () => ["deletedItems", "list"] as const,
  },
  errorLog: {
    all: ["errorLog"] as const,
    list: (filters?: Record<string, unknown>) => ["errorLog", "list", filters ?? {}] as const,
  },
  systemHealth: {
    usage: () => ["systemHealth", "usage"] as const,
  },
  systemDoctor: {
    all: ["systemDoctor"] as const,
    history: () => ["systemDoctor", "history"] as const,
  },
  executiveKpis: {
    all: ["executiveKpis"] as const,
  },
  executiveReport: {
    detail: (token?: string) => ["executiveReport", token] as const,
  },
  applicantImportTemplates: {
    all: ["applicantImportTemplates"] as const,
    list: () => ["applicantImportTemplates", "list"] as const,
  },
  applicantImportJobs: {
    all: ["applicantImportJobs"] as const,
    list: () => ["applicantImportJobs", "list"] as const,
    // Separate filtered read (status="running", limit 1) used to detect a job
    // left mid-run by a crashed/closed tab — same table, nested under the same
    // prefix so one invalidation after submit() refreshes both.
    staleCheck: () => ["applicantImportJobs", "staleCheck"] as const,
  },
  storage: {
    // Signed URL for a private storage object — keyed by path so the same
    // file shown in multiple places (list + detail view) costs one fetch.
    signedUrl: (path: string) => ["storage", "signedUrl", path] as const,
  },
  scorecards: {
    all: ["scorecards"] as const,
    list: () => ["scorecards", "list"] as const,
  },
  offerLetters: {
    all: ["offerLetters"] as const,
    list: () => ["offerLetters", "list"] as const,
  },
  talentPool: {
    all: ["talentPool"] as const,
    list: () => ["talentPool", "list"] as const,
  },
  jobRequisitions: {
    all: ["jobRequisitions"] as const,
    list: () => ["jobRequisitions", "list"] as const,
  },
  referrals: {
    all: ["referrals"] as const,
    list: () => ["referrals", "list"] as const,
  },
  slaDashboard: {
    all: ["slaDashboard"] as const,
    config: () => ["slaDashboard", "config"] as const,
    metrics: () => ["slaDashboard", "metrics"] as const,
  },
  recruiterAssignments: {
    all: ["recruiterAssignments"] as const,
    list: () => ["recruiterAssignments", "list"] as const,
  },
  onboarding: {
    all: ["onboarding"] as const,
    templates: () => ["onboarding", "templates"] as const,
    checklists: () => ["onboarding", "checklists"] as const,
  },
  budgetTracking: {
    all: ["budgetTracking"] as const,
    budgets: () => ["budgetTracking", "budgets"] as const,
    costs: () => ["budgetTracking", "costs"] as const,
  },
  gdprTools: {
    all: ["gdprTools"] as const,
    policies: () => ["gdprTools", "policies"] as const,
    requests: () => ["gdprTools", "requests"] as const,
  },
  automationRules: {
    all: ["automationRules"] as const,
    list: () => ["automationRules", "list"] as const,
    logs: () => ["automationRules", "logs"] as const,
  },
  assessments: {
    all: ["assessments"] as const,
    list: () => ["assessments", "list"] as const,
    assignments: () => ["assessments", "assignments"] as const,
  },
  messaging: {
    all: ["messaging"] as const,
    settings: () => ["messaging", "settings"] as const,
    templates: () => ["messaging", "templates"] as const,
    log: () => ["messaging", "log"] as const,
  },
  videoInterviews: {
    all: ["videoInterviews"] as const,
    sessions: () => ["videoInterviews", "sessions"] as const,
    settings: () => ["videoInterviews", "settings"] as const,
  },
  jobBoards: {
    all: ["jobBoards"] as const,
    accounts: () => ["jobBoards", "accounts"] as const,
    publications: () => ["jobBoards", "publications"] as const,
  },
  emailTemplates: {
    all: ["emailTemplates"] as const,
    list: () => ["emailTemplates", "list"] as const,
    campaigns: () => ["emailTemplates", "campaigns"] as const,
  },
  integrations: {
    all: ["integrations"] as const,
    list: () => ["integrations", "list"] as const,
    webhooks: () => ["integrations", "webhooks"] as const,
    deliveries: () => ["integrations", "deliveries"] as const,
  },
  employees: {
    all: ["employees"] as const,
    list: () => ["employees", "list"] as const,
    detail: (id?: string) => ["employees", "detail", id] as const,
  },
  hrFormTemplates: {
    all: ["hrFormTemplates"] as const,
    list: () => ["hrFormTemplates", "list"] as const,
    detail: (id?: string) => ["hrFormTemplates", "detail", id] as const,
  },
  hrFormSubmissions: {
    all: ["hrFormSubmissions"] as const,
    list: (filters?: Record<string, unknown>) => ["hrFormSubmissions", "list", filters ?? {}] as const,
    detail: (id?: string) => ["hrFormSubmissions", "detail", id] as const,
  },
  hrFormTemplatePermissions: {
    all: ["hrFormTemplatePermissions"] as const,
    list: () => ["hrFormTemplatePermissions", "list"] as const,
  },
  hrFormIssuances: {
    all: ["hrFormIssuances"] as const,
    list: () => ["hrFormIssuances", "list"] as const,
  },
  clientPortal: {
    all: ["clientPortal"] as const,
    // Nested under `all` so useRevealCandidateMutation can patch every cached
    // page/filter/search combo at once via a prefix match, without needing to
    // know which exact page the user is currently viewing.
    search: (filters?: { field: string; value: string }[], search?: string, page?: number, searchMode?: string) =>
      ["clientPortal", "search", filters ?? [], search ?? "", page ?? 1, searchMode ?? "any"] as const,
    // Distinct-value facet counts for one filterable field, scoped to the
    // OTHER currently-applied filters (so counts stay faceted/contextual).
    facets: (field: string, otherFilters?: { field: string; value: string }[]) =>
      ["clientPortal", "facets", field, otherFilters ?? []] as const,
  },
} as const;
