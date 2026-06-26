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
  valueSynonyms: {
    all: ["valueSynonyms"] as const,
    list: () => ["valueSynonyms", "list"] as const,
  },
  dropdownOptions: {
    all: ["dropdownOptions"] as const,
    list: (field?: string) => ["dropdownOptions", "list", field] as const,
  },
  fieldConfig: {
    all: ["fieldConfig"] as const,
    list: () => ["fieldConfig", "list"] as const,
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
} as const;
