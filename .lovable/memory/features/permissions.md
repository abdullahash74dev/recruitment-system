---
name: Granular user permissions system
description: Per-user permissions with role defaults, stored in user_permissions table
type: feature
---
- Table `user_permissions` stores per-user overrides (permission_key + granted boolean)
- DB function `has_permission()` checks custom overrides, falls back to role defaults
- Permission keys: view_applicants, edit_applicants, view_jobs, edit_jobs, view_projects, edit_projects, view_analytics, manage_settings, manage_users, manage_backup
- Role defaults: admin=all, hr_manager/recruitment_coordinator=view+edit applicants/jobs + view projects/analytics, project_manager=view only
- Dashboard tabs shown/hidden based on permissions via `useUserPermissions` hook
- Admin can customize per-user permissions via `UserPermissionsDialog` (Shield icon in users table)
