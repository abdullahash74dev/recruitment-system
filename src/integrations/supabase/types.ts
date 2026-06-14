export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      ai_settings: {
        Row: {
          id: string
          provider: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          provider?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          provider?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      ai_usage_log: {
        Row: {
          completion_tokens: number | null
          created_at: string
          duration_ms: number | null
          error_code: string | null
          estimated_cost_usd: number | null
          id: string
          metadata: Json | null
          model: string | null
          prompt_tokens: number | null
          service: string
          status: string
          total_tokens: number | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          completion_tokens?: number | null
          created_at?: string
          duration_ms?: number | null
          error_code?: string | null
          estimated_cost_usd?: number | null
          id?: string
          metadata?: Json | null
          model?: string | null
          prompt_tokens?: number | null
          service: string
          status?: string
          total_tokens?: number | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          completion_tokens?: number | null
          created_at?: string
          duration_ms?: number | null
          error_code?: string | null
          estimated_cost_usd?: number | null
          id?: string
          metadata?: Json | null
          model?: string | null
          prompt_tokens?: number | null
          service?: string
          status?: string
          total_tokens?: number | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      ai_usage_settings: {
        Row: {
          display_name_ar: string
          display_name_en: string | null
          hard_stop: boolean
          id: string
          is_active: boolean
          monthly_cap_usd: number
          service: string
          updated_at: string
          warn_threshold_pct: number
        }
        Insert: {
          display_name_ar: string
          display_name_en?: string | null
          hard_stop?: boolean
          id?: string
          is_active?: boolean
          monthly_cap_usd?: number
          service: string
          updated_at?: string
          warn_threshold_pct?: number
        }
        Update: {
          display_name_ar?: string
          display_name_en?: string | null
          hard_stop?: boolean
          id?: string
          is_active?: boolean
          monthly_cap_usd?: number
          service?: string
          updated_at?: string
          warn_threshold_pct?: number
        }
        Relationships: []
      }
      app_secrets: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: []
      }
      applicant_emails: {
        Row: {
          applicant_id: string
          body_preview: string | null
          created_at: string
          error_message: string | null
          id: string
          language: string
          recipient_email: string
          rejection_note: string | null
          rejection_reason_id: string | null
          send_status: string
          sent_by: string | null
          sent_by_email: string | null
          status_at_send: string
          subject: string | null
          template_key: string
        }
        Insert: {
          applicant_id: string
          body_preview?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          language?: string
          recipient_email: string
          rejection_note?: string | null
          rejection_reason_id?: string | null
          send_status?: string
          sent_by?: string | null
          sent_by_email?: string | null
          status_at_send: string
          subject?: string | null
          template_key: string
        }
        Update: {
          applicant_id?: string
          body_preview?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          language?: string
          recipient_email?: string
          rejection_note?: string | null
          rejection_reason_id?: string | null
          send_status?: string
          sent_by?: string | null
          sent_by_email?: string | null
          status_at_send?: string
          subject?: string | null
          template_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "applicant_emails_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "applicants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applicant_emails_rejection_reason_id_fkey"
            columns: ["rejection_reason_id"]
            isOneToOne: false
            referencedRelation: "rejection_reasons"
            referencedColumns: ["id"]
          },
        ]
      }
      applicants: {
        Row: {
          arabic_level: string | null
          archived_at: string | null
          available_date: string | null
          birth_date: string | null
          created_at: string
          current_city: string | null
          current_salary: string | null
          current_study: string | null
          current_tasks: string | null
          current_title: string | null
          currently_employed: string | null
          currently_studying: string | null
          degree_url: string | null
          dependents: number | null
          desired_position: string | null
          education_level: string | null
          email: string | null
          english_level: string | null
          expected_salary: string | null
          experience_cert_url: string | null
          facility_management_exp: string | null
          full_name: string
          gender: string | null
          gpa: string | null
          graduation_year: string | null
          has_transport: string | null
          hear_about: string | null
          id: string
          is_archived: boolean
          job_type: string | null
          linkedin: string | null
          major: string | null
          marital_status: string | null
          nationality: string | null
          notes: string | null
          other_docs_url: string | null
          other_experience: string | null
          other_language: string | null
          phone: string | null
          preferred_city: string | null
          resume_url: string | null
          self_summary: string | null
          source: string
          source_company: string | null
          status: Database["public"]["Enums"]["applicant_status"]
          submission_token_hash: string | null
          training_certs_url: string | null
          university: string | null
          updated_at: string
          years_experience: string | null
        }
        Insert: {
          arabic_level?: string | null
          archived_at?: string | null
          available_date?: string | null
          birth_date?: string | null
          created_at?: string
          current_city?: string | null
          current_salary?: string | null
          current_study?: string | null
          current_tasks?: string | null
          current_title?: string | null
          currently_employed?: string | null
          currently_studying?: string | null
          degree_url?: string | null
          dependents?: number | null
          desired_position?: string | null
          education_level?: string | null
          email?: string | null
          english_level?: string | null
          expected_salary?: string | null
          experience_cert_url?: string | null
          facility_management_exp?: string | null
          full_name: string
          gender?: string | null
          gpa?: string | null
          graduation_year?: string | null
          has_transport?: string | null
          hear_about?: string | null
          id?: string
          is_archived?: boolean
          job_type?: string | null
          linkedin?: string | null
          major?: string | null
          marital_status?: string | null
          nationality?: string | null
          notes?: string | null
          other_docs_url?: string | null
          other_experience?: string | null
          other_language?: string | null
          phone?: string | null
          preferred_city?: string | null
          resume_url?: string | null
          self_summary?: string | null
          source?: string
          source_company?: string | null
          status?: Database["public"]["Enums"]["applicant_status"]
          submission_token_hash?: string | null
          training_certs_url?: string | null
          university?: string | null
          updated_at?: string
          years_experience?: string | null
        }
        Update: {
          arabic_level?: string | null
          archived_at?: string | null
          available_date?: string | null
          birth_date?: string | null
          created_at?: string
          current_city?: string | null
          current_salary?: string | null
          current_study?: string | null
          current_tasks?: string | null
          current_title?: string | null
          currently_employed?: string | null
          currently_studying?: string | null
          degree_url?: string | null
          dependents?: number | null
          desired_position?: string | null
          education_level?: string | null
          email?: string | null
          english_level?: string | null
          expected_salary?: string | null
          experience_cert_url?: string | null
          facility_management_exp?: string | null
          full_name?: string
          gender?: string | null
          gpa?: string | null
          graduation_year?: string | null
          has_transport?: string | null
          hear_about?: string | null
          id?: string
          is_archived?: boolean
          job_type?: string | null
          linkedin?: string | null
          major?: string | null
          marital_status?: string | null
          nationality?: string | null
          notes?: string | null
          other_docs_url?: string | null
          other_experience?: string | null
          other_language?: string | null
          phone?: string | null
          preferred_city?: string | null
          resume_url?: string | null
          self_summary?: string | null
          source?: string
          source_company?: string | null
          status?: Database["public"]["Enums"]["applicant_status"]
          submission_token_hash?: string | null
          training_certs_url?: string | null
          university?: string | null
          updated_at?: string
          years_experience?: string | null
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          id: string
          ip_address: string | null
          new_data: Json | null
          occurred_at: string
          old_data: Json | null
          record_id: string | null
          summary: string | null
          table_name: string | null
          user_agent: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          occurred_at?: string
          old_data?: Json | null
          record_id?: string | null
          summary?: string | null
          table_name?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          occurred_at?: string
          old_data?: Json | null
          record_id?: string | null
          summary?: string | null
          table_name?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      backup_runs: {
        Row: {
          created_at: string
          error_message: string | null
          file_path: string | null
          file_size: number | null
          id: string
          status: string
          tables_summary: Json | null
          triggered_by: string
          triggered_by_user: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          status?: string
          tables_summary?: Json | null
          triggered_by?: string
          triggered_by_user?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          status?: string
          tables_summary?: Json | null
          triggered_by?: string
          triggered_by_user?: string | null
        }
        Relationships: []
      }
      custom_answers: {
        Row: {
          answer: string | null
          applicant_id: string
          created_at: string
          id: string
          question_id: string
          submission_token_hash: string | null
        }
        Insert: {
          answer?: string | null
          applicant_id: string
          created_at?: string
          id?: string
          question_id: string
          submission_token_hash?: string | null
        }
        Update: {
          answer?: string | null
          applicant_id?: string
          created_at?: string
          id?: string
          question_id?: string
          submission_token_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_answers_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "applicants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "custom_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_questions: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          is_required: boolean
          options_ar: string[] | null
          options_en: string[] | null
          question_ar: string
          question_en: string | null
          sort_order: number
          step_number: number
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_required?: boolean
          options_ar?: string[] | null
          options_en?: string[] | null
          question_ar: string
          question_en?: string | null
          sort_order?: number
          step_number?: number
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_required?: boolean
          options_ar?: string[] | null
          options_en?: string[] | null
          question_ar?: string
          question_en?: string | null
          sort_order?: number
          step_number?: number
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      dashboard_preferences: {
        Row: {
          id: string
          prefs: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          prefs?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          prefs?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      deleted_items: {
        Row: {
          data: Json
          deleted_at: string
          deleted_by: string | null
          deleted_by_email: string | null
          expires_at: string
          id: string
          original_id: string
          restored: boolean
          restored_at: string | null
          restored_by: string | null
          table_name: string
        }
        Insert: {
          data: Json
          deleted_at?: string
          deleted_by?: string | null
          deleted_by_email?: string | null
          expires_at?: string
          id?: string
          original_id: string
          restored?: boolean
          restored_at?: string | null
          restored_by?: string | null
          table_name: string
        }
        Update: {
          data?: Json
          deleted_at?: string
          deleted_by?: string | null
          deleted_by_email?: string | null
          expires_at?: string
          id?: string
          original_id?: string
          restored?: boolean
          restored_at?: string | null
          restored_by?: string | null
          table_name?: string
        }
        Relationships: []
      }
      dropdown_options: {
        Row: {
          created_at: string
          field_name: string
          id: string
          is_active: boolean
          options_ar: string[]
          options_en: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          field_name: string
          id?: string
          is_active?: boolean
          options_ar?: string[]
          options_en?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          field_name?: string
          id?: string
          is_active?: boolean
          options_ar?: string[]
          options_en?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      executive_share_links: {
        Row: {
          created_at: string
          created_by: string | null
          created_by_email: string | null
          default_prefs: Json
          expires_at: string | null
          id: string
          is_active: boolean
          label: string | null
          last_viewed_at: string | null
          token: string
          view_count: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          default_prefs?: Json
          expires_at?: string | null
          id?: string
          is_active?: boolean
          label?: string | null
          last_viewed_at?: string | null
          token: string
          view_count?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          default_prefs?: Json
          expires_at?: string | null
          id?: string
          is_active?: boolean
          label?: string | null
          last_viewed_at?: string | null
          token?: string
          view_count?: number
        }
        Relationships: []
      }
      form_field_config: {
        Row: {
          created_at: string
          field_name: string
          id: string
          is_required: boolean
          is_visible: boolean
          label_ar: string | null
          label_en: string | null
          sort_order: number
          step_number: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          field_name: string
          id?: string
          is_required?: boolean
          is_visible?: boolean
          label_ar?: string | null
          label_en?: string | null
          sort_order?: number
          step_number?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          field_name?: string
          id?: string
          is_required?: boolean
          is_visible?: boolean
          label_ar?: string | null
          label_en?: string | null
          sort_order?: number
          step_number?: number
          updated_at?: string
        }
        Relationships: []
      }
      job_advertisements: {
        Row: {
          accent_color: string | null
          ai_metadata: Json | null
          background_url: string | null
          created_at: string
          created_by: string | null
          created_by_email: string | null
          design_style: string
          expiry_date: string | null
          id: string
          job_ids: string[]
          layout_type: string
          logo_url: string | null
          manual_jobs: Json
          notes: string | null
          publish_date: string | null
          qr_url: string | null
          secondary_color: string | null
          show_qr: boolean
          subtitle_ar: string | null
          subtitle_en: string | null
          text_color: string | null
          title_ar: string
          title_en: string | null
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          ai_metadata?: Json | null
          background_url?: string | null
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          design_style?: string
          expiry_date?: string | null
          id?: string
          job_ids?: string[]
          layout_type?: string
          logo_url?: string | null
          manual_jobs?: Json
          notes?: string | null
          publish_date?: string | null
          qr_url?: string | null
          secondary_color?: string | null
          show_qr?: boolean
          subtitle_ar?: string | null
          subtitle_en?: string | null
          text_color?: string | null
          title_ar: string
          title_en?: string | null
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          ai_metadata?: Json | null
          background_url?: string | null
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          design_style?: string
          expiry_date?: string | null
          id?: string
          job_ids?: string[]
          layout_type?: string
          logo_url?: string | null
          manual_jobs?: Json
          notes?: string | null
          publish_date?: string | null
          qr_url?: string | null
          secondary_color?: string | null
          show_qr?: boolean
          subtitle_ar?: string | null
          subtitle_en?: string | null
          text_color?: string | null
          title_ar?: string
          title_en?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      job_categories: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name_ar: string
          name_en: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name_ar: string
          name_en?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name_ar?: string
          name_en?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      job_postings: {
        Row: {
          additional_details_ar: string | null
          additional_details_en: string | null
          created_at: string
          degree_required_ar: string | null
          degree_required_en: string | null
          department: string | null
          department_en: string | null
          description_ar: string | null
          description_en: string | null
          experience_required_ar: string | null
          experience_required_en: string | null
          id: string
          is_active: boolean
          job_type: string
          job_type_en: string | null
          location: string
          location_en: string | null
          nationality_required: string | null
          nationality_required_en: string | null
          posting_category: string
          project_id: string | null
          requirements_ar: string | null
          requirements_en: string | null
          salary_range: string | null
          title_ar: string
          title_en: string | null
          updated_at: string
          vacancy_count: number
        }
        Insert: {
          additional_details_ar?: string | null
          additional_details_en?: string | null
          created_at?: string
          degree_required_ar?: string | null
          degree_required_en?: string | null
          department?: string | null
          department_en?: string | null
          description_ar?: string | null
          description_en?: string | null
          experience_required_ar?: string | null
          experience_required_en?: string | null
          id?: string
          is_active?: boolean
          job_type: string
          job_type_en?: string | null
          location: string
          location_en?: string | null
          nationality_required?: string | null
          nationality_required_en?: string | null
          posting_category?: string
          project_id?: string | null
          requirements_ar?: string | null
          requirements_en?: string | null
          salary_range?: string | null
          title_ar: string
          title_en?: string | null
          updated_at?: string
          vacancy_count?: number
        }
        Update: {
          additional_details_ar?: string | null
          additional_details_en?: string | null
          created_at?: string
          degree_required_ar?: string | null
          degree_required_en?: string | null
          department?: string | null
          department_en?: string | null
          description_ar?: string | null
          description_en?: string | null
          experience_required_ar?: string | null
          experience_required_en?: string | null
          id?: string
          is_active?: boolean
          job_type?: string
          job_type_en?: string | null
          location?: string
          location_en?: string | null
          nationality_required?: string | null
          nationality_required_en?: string | null
          posting_category?: string
          project_id?: string | null
          requirements_ar?: string | null
          requirements_en?: string | null
          salary_range?: string | null
          title_ar?: string
          title_en?: string | null
          updated_at?: string
          vacancy_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "job_postings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      job_title_categories: {
        Row: {
          category_id: string | null
          created_at: string
          id: string
          title_display: string
          title_normalized: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          id?: string
          title_display: string
          title_normalized: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          id?: string
          title_display?: string
          title_normalized?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_title_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "job_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          metadata: Json
          severity: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          metadata?: Json
          severity?: string
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          metadata?: Json
          severity?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          is_active: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          created_at: string
          description_ar: string | null
          description_en: string | null
          id: string
          is_active: boolean
          logo_bg_color: string | null
          logo_border: boolean
          logo_fit: string
          logo_height: number
          logo_padding: number
          logo_radius: number
          logo_rotation: number
          logo_shadow: boolean
          logo_url: string | null
          logo_width: number | null
          name_ar: string
          name_en: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          id?: string
          is_active?: boolean
          logo_bg_color?: string | null
          logo_border?: boolean
          logo_fit?: string
          logo_height?: number
          logo_padding?: number
          logo_radius?: number
          logo_rotation?: number
          logo_shadow?: boolean
          logo_url?: string | null
          logo_width?: number | null
          name_ar: string
          name_en?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          id?: string
          is_active?: boolean
          logo_bg_color?: string | null
          logo_border?: boolean
          logo_fit?: string
          logo_height?: number
          logo_padding?: number
          logo_radius?: number
          logo_rotation?: number
          logo_shadow?: boolean
          logo_url?: string | null
          logo_width?: number | null
          name_ar?: string
          name_en?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      recruitment_candidates: {
        Row: {
          actual_start_date: string | null
          batch_label: string | null
          created_at: string
          cv_url: string | null
          email: string | null
          expected_start_date: string | null
          full_name: string
          hire_date: string | null
          id: string
          imported_batch_id: string | null
          interview_date: string | null
          job_title_id: string
          nationality: string | null
          notes: string | null
          offer_sent_date: string | null
          offer_signed_date: string | null
          phone: string | null
          project_id: string
          rejected_note: string | null
          rejected_reason_id: string | null
          status: Database["public"]["Enums"]["recruitment_status"]
          updated_at: string
        }
        Insert: {
          actual_start_date?: string | null
          batch_label?: string | null
          created_at?: string
          cv_url?: string | null
          email?: string | null
          expected_start_date?: string | null
          full_name: string
          hire_date?: string | null
          id?: string
          imported_batch_id?: string | null
          interview_date?: string | null
          job_title_id: string
          nationality?: string | null
          notes?: string | null
          offer_sent_date?: string | null
          offer_signed_date?: string | null
          phone?: string | null
          project_id: string
          rejected_note?: string | null
          rejected_reason_id?: string | null
          status?: Database["public"]["Enums"]["recruitment_status"]
          updated_at?: string
        }
        Update: {
          actual_start_date?: string | null
          batch_label?: string | null
          created_at?: string
          cv_url?: string | null
          email?: string | null
          expected_start_date?: string | null
          full_name?: string
          hire_date?: string | null
          id?: string
          imported_batch_id?: string | null
          interview_date?: string | null
          job_title_id?: string
          nationality?: string | null
          notes?: string | null
          offer_sent_date?: string | null
          offer_signed_date?: string | null
          phone?: string | null
          project_id?: string
          rejected_note?: string | null
          rejected_reason_id?: string | null
          status?: Database["public"]["Enums"]["recruitment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recruitment_candidates_imported_batch_id_fkey"
            columns: ["imported_batch_id"]
            isOneToOne: false
            referencedRelation: "recruitment_import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruitment_candidates_job_title_id_fkey"
            columns: ["job_title_id"]
            isOneToOne: false
            referencedRelation: "recruitment_job_title_stats"
            referencedColumns: ["job_title_id"]
          },
          {
            foreignKeyName: "recruitment_candidates_job_title_id_fkey"
            columns: ["job_title_id"]
            isOneToOne: false
            referencedRelation: "recruitment_job_titles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruitment_candidates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "recruitment_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruitment_candidates_rejected_reason_id_fkey"
            columns: ["rejected_reason_id"]
            isOneToOne: false
            referencedRelation: "rejection_reasons"
            referencedColumns: ["id"]
          },
        ]
      }
      recruitment_import_batches: {
        Row: {
          created_at: string
          errors: Json | null
          failed_rows: number
          filename: string | null
          id: string
          imported_by: string | null
          imported_by_email: string | null
          inserted_rows: number
          total_rows: number
        }
        Insert: {
          created_at?: string
          errors?: Json | null
          failed_rows?: number
          filename?: string | null
          id?: string
          imported_by?: string | null
          imported_by_email?: string | null
          inserted_rows?: number
          total_rows?: number
        }
        Update: {
          created_at?: string
          errors?: Json | null
          failed_rows?: number
          filename?: string | null
          id?: string
          imported_by?: string | null
          imported_by_email?: string | null
          inserted_rows?: number
          total_rows?: number
        }
        Relationships: []
      }
      recruitment_job_titles: {
        Row: {
          category_id: string | null
          created_at: string
          id: string
          is_active: boolean
          is_published_to_board: boolean
          job_type: string | null
          location: string | null
          nationality_required: string | null
          project_id: string
          requirements_ar: string | null
          requirements_en: string | null
          salary_range: string | null
          synced_job_posting_id: string | null
          target_headcount: number
          title_ar: string
          title_en: string | null
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_published_to_board?: boolean
          job_type?: string | null
          location?: string | null
          nationality_required?: string | null
          project_id: string
          requirements_ar?: string | null
          requirements_en?: string | null
          salary_range?: string | null
          synced_job_posting_id?: string | null
          target_headcount?: number
          title_ar: string
          title_en?: string | null
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_published_to_board?: boolean
          job_type?: string | null
          location?: string | null
          nationality_required?: string | null
          project_id?: string
          requirements_ar?: string | null
          requirements_en?: string | null
          salary_range?: string | null
          synced_job_posting_id?: string | null
          target_headcount?: number
          title_ar?: string
          title_en?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recruitment_job_titles_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "job_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruitment_job_titles_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "recruitment_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      recruitment_projects: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          name_ar: string
          name_en: string | null
          notes: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name_ar: string
          name_en?: string | null
          notes?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name_ar?: string
          name_en?: string | null
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      rejection_reasons: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          reason_ar: string
          reason_en: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          reason_ar: string
          reason_en?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          reason_ar?: string
          reason_en?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      report_runs: {
        Row: {
          error_message: string | null
          file_name: string | null
          file_url: string | null
          id: string
          insights_summary: string | null
          run_at: string
          scheduled_report_id: string | null
          status: string
          template_id: string | null
          triggered_by: string | null
        }
        Insert: {
          error_message?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          insights_summary?: string | null
          run_at?: string
          scheduled_report_id?: string | null
          status?: string
          template_id?: string | null
          triggered_by?: string | null
        }
        Update: {
          error_message?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          insights_summary?: string | null
          run_at?: string
          scheduled_report_id?: string | null
          status?: string
          template_id?: string | null
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_runs_scheduled_report_id_fkey"
            columns: ["scheduled_report_id"]
            isOneToOne: false
            referencedRelation: "scheduled_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      report_templates: {
        Row: {
          config: Json
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          scope: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          scope?: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          scope?: string
          updated_at?: string
        }
        Relationships: []
      }
      scheduled_reports: {
        Row: {
          created_at: string
          created_by: string | null
          format: string
          frequency: string
          id: string
          is_active: boolean
          last_run_at: string | null
          name: string
          next_run_at: string | null
          recipient_user_ids: string[]
          report_type: string
          template_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          format?: string
          frequency?: string
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          name: string
          next_run_at?: string | null
          recipient_user_ids?: string[]
          report_type?: string
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          format?: string
          frequency?: string
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          name?: string
          next_run_at?: string | null
          recipient_user_ids?: string[]
          report_type?: string
          template_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          accent_color: string | null
          apply_desc_ar: string | null
          apply_desc_en: string | null
          apply_title_ar: string | null
          apply_title_en: string | null
          created_at: string
          cta_bg_color: string | null
          cta_desc_ar: string | null
          cta_desc_en: string | null
          cta_title_ar: string | null
          cta_title_en: string | null
          employee_count: string | null
          feature1_desc_ar: string | null
          feature1_desc_en: string | null
          feature1_title_ar: string | null
          feature1_title_en: string | null
          feature2_desc_ar: string | null
          feature2_desc_en: string | null
          feature2_title_ar: string | null
          feature2_title_en: string | null
          feature3_desc_ar: string | null
          feature3_desc_en: string | null
          feature3_title_ar: string | null
          feature3_title_en: string | null
          features_bg_color: string | null
          founding_year: string | null
          hero_bg_color: string | null
          hero_bg_color_mobile: string | null
          hero_desc_ar: string | null
          hero_desc_en: string | null
          hero_title_size_desktop: string | null
          hero_title_size_mobile: string | null
          hero_title1_ar: string | null
          hero_title1_en: string | null
          hero_title2_ar: string | null
          hero_title2_en: string | null
          id: string
          job_page_additional_title_ar: string | null
          job_page_additional_title_en: string | null
          job_page_apply_btn_ar: string | null
          job_page_apply_btn_bg: string | null
          job_page_apply_btn_en: string | null
          job_page_apply_btn_text_color: string | null
          job_page_apply_desc_ar: string | null
          job_page_apply_desc_en: string | null
          job_page_apply_title_ar: string | null
          job_page_apply_title_en: string | null
          job_page_brand_text_ar: string | null
          job_page_brand_text_en: string | null
          job_page_card_bg: string | null
          job_page_card_border_color: string | null
          job_page_card_radius: number
          job_page_description_title_ar: string | null
          job_page_description_title_en: string | null
          job_page_hero_bg: string | null
          job_page_icon_color: string | null
          job_page_logo_bg_color: string | null
          job_page_logo_border: boolean
          job_page_logo_height: number
          job_page_logo_padding: number
          job_page_logo_radius: number
          job_page_logo_shadow: boolean
          job_page_logo_url: string | null
          job_page_requirements_title_ar: string | null
          job_page_requirements_title_en: string | null
          job_page_show_brand_text: boolean
          jobs_completed_label_ar: string | null
          jobs_completed_label_en: string | null
          jobs_group_by_location: boolean | null
          jobs_other_label_ar: string | null
          jobs_other_label_en: string | null
          jobs_section_title_ar: string | null
          jobs_section_title_en: string | null
          jobs_show_completed: boolean | null
          logo_alignment: string | null
          logo_bg_color: string | null
          logo_bg_color_mobile: string | null
          logo_bg_enabled: boolean | null
          logo_border: boolean
          logo_border_radius: string | null
          logo_border_radius_mobile: string | null
          logo_fit: string
          logo_height: string | null
          logo_height_mobile: number | null
          logo_offset_x: number
          logo_offset_y: number
          logo_padding: number
          logo_padding_mobile: number | null
          logo_rotation: number
          logo_shadow: boolean
          logo_url: string | null
          logo_width: number | null
          logo_width_mobile: number | null
          primary_color: string | null
          public_theme_palette: string
          projects_count: string | null
          show_nationality_on_jobs: boolean
          show_projects_section: boolean | null
          show_stats_section: boolean | null
          site_name_ar: string | null
          site_name_en: string | null
          stats_bg_color: string | null
          stats_section_title_ar: string | null
          stats_section_title_en: string | null
          success_desc_ar: string | null
          success_desc_en: string | null
          success_title_ar: string | null
          success_title_en: string | null
          training_page_desc_ar: string | null
          training_page_desc_en: string | null
          training_page_title_ar: string | null
          training_page_title_en: string | null
          two_factor_enabled: boolean
          ui_styles: Json | null
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          apply_desc_ar?: string | null
          apply_desc_en?: string | null
          apply_title_ar?: string | null
          apply_title_en?: string | null
          created_at?: string
          cta_bg_color?: string | null
          cta_desc_ar?: string | null
          cta_desc_en?: string | null
          cta_title_ar?: string | null
          cta_title_en?: string | null
          employee_count?: string | null
          feature1_desc_ar?: string | null
          feature1_desc_en?: string | null
          feature1_title_ar?: string | null
          feature1_title_en?: string | null
          feature2_desc_ar?: string | null
          feature2_desc_en?: string | null
          feature2_title_ar?: string | null
          feature2_title_en?: string | null
          feature3_desc_ar?: string | null
          feature3_desc_en?: string | null
          feature3_title_ar?: string | null
          feature3_title_en?: string | null
          features_bg_color?: string | null
          founding_year?: string | null
          hero_bg_color?: string | null
          hero_bg_color_mobile?: string | null
          hero_desc_ar?: string | null
          hero_desc_en?: string | null
          hero_title_size_desktop?: string | null
          hero_title_size_mobile?: string | null
          hero_title1_ar?: string | null
          hero_title1_en?: string | null
          hero_title2_ar?: string | null
          hero_title2_en?: string | null
          id?: string
          job_page_additional_title_ar?: string | null
          job_page_additional_title_en?: string | null
          job_page_apply_btn_ar?: string | null
          job_page_apply_btn_bg?: string | null
          job_page_apply_btn_en?: string | null
          job_page_apply_btn_text_color?: string | null
          job_page_apply_desc_ar?: string | null
          job_page_apply_desc_en?: string | null
          job_page_apply_title_ar?: string | null
          job_page_apply_title_en?: string | null
          job_page_brand_text_ar?: string | null
          job_page_brand_text_en?: string | null
          job_page_card_bg?: string | null
          job_page_card_border_color?: string | null
          job_page_card_radius?: number
          job_page_description_title_ar?: string | null
          job_page_description_title_en?: string | null
          job_page_hero_bg?: string | null
          job_page_icon_color?: string | null
          job_page_logo_bg_color?: string | null
          job_page_logo_border?: boolean
          job_page_logo_height?: number
          job_page_logo_padding?: number
          job_page_logo_radius?: number
          job_page_logo_shadow?: boolean
          job_page_logo_url?: string | null
          job_page_requirements_title_ar?: string | null
          job_page_requirements_title_en?: string | null
          job_page_show_brand_text?: boolean
          jobs_completed_label_ar?: string | null
          jobs_completed_label_en?: string | null
          jobs_group_by_location?: boolean | null
          jobs_other_label_ar?: string | null
          jobs_other_label_en?: string | null
          jobs_section_title_ar?: string | null
          jobs_section_title_en?: string | null
          jobs_show_completed?: boolean | null
          logo_alignment?: string | null
          logo_bg_color?: string | null
          logo_bg_color_mobile?: string | null
          logo_bg_enabled?: boolean | null
          logo_border?: boolean
          logo_border_radius?: string | null
          logo_border_radius_mobile?: string | null
          logo_fit?: string
          logo_height?: string | null
          logo_height_mobile?: number | null
          logo_offset_x?: number
          logo_offset_y?: number
          logo_padding?: number
          logo_padding_mobile?: number | null
          logo_rotation?: number
          logo_shadow?: boolean
          logo_url?: string | null
          logo_width?: number | null
          logo_width_mobile?: number | null
          primary_color?: string | null
          public_theme_palette?: string
          projects_count?: string | null
          show_nationality_on_jobs?: boolean
          show_projects_section?: boolean | null
          show_stats_section?: boolean | null
          site_name_ar?: string | null
          site_name_en?: string | null
          stats_bg_color?: string | null
          stats_section_title_ar?: string | null
          stats_section_title_en?: string | null
          success_desc_ar?: string | null
          success_desc_en?: string | null
          success_title_ar?: string | null
          success_title_en?: string | null
          training_page_desc_ar?: string | null
          training_page_desc_en?: string | null
          training_page_title_ar?: string | null
          training_page_title_en?: string | null
          two_factor_enabled?: boolean
          ui_styles?: Json | null
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          apply_desc_ar?: string | null
          apply_desc_en?: string | null
          apply_title_ar?: string | null
          apply_title_en?: string | null
          created_at?: string
          cta_bg_color?: string | null
          cta_desc_ar?: string | null
          cta_desc_en?: string | null
          cta_title_ar?: string | null
          cta_title_en?: string | null
          employee_count?: string | null
          feature1_desc_ar?: string | null
          feature1_desc_en?: string | null
          feature1_title_ar?: string | null
          feature1_title_en?: string | null
          feature2_desc_ar?: string | null
          feature2_desc_en?: string | null
          feature2_title_ar?: string | null
          feature2_title_en?: string | null
          feature3_desc_ar?: string | null
          feature3_desc_en?: string | null
          feature3_title_ar?: string | null
          feature3_title_en?: string | null
          features_bg_color?: string | null
          founding_year?: string | null
          hero_bg_color?: string | null
          hero_bg_color_mobile?: string | null
          hero_desc_ar?: string | null
          hero_desc_en?: string | null
          hero_title_size_desktop?: string | null
          hero_title_size_mobile?: string | null
          hero_title1_ar?: string | null
          hero_title1_en?: string | null
          hero_title2_ar?: string | null
          hero_title2_en?: string | null
          id?: string
          job_page_additional_title_ar?: string | null
          job_page_additional_title_en?: string | null
          job_page_apply_btn_ar?: string | null
          job_page_apply_btn_bg?: string | null
          job_page_apply_btn_en?: string | null
          job_page_apply_btn_text_color?: string | null
          job_page_apply_desc_ar?: string | null
          job_page_apply_desc_en?: string | null
          job_page_apply_title_ar?: string | null
          job_page_apply_title_en?: string | null
          job_page_brand_text_ar?: string | null
          job_page_brand_text_en?: string | null
          job_page_card_bg?: string | null
          job_page_card_border_color?: string | null
          job_page_card_radius?: number
          job_page_description_title_ar?: string | null
          job_page_description_title_en?: string | null
          job_page_hero_bg?: string | null
          job_page_icon_color?: string | null
          job_page_logo_bg_color?: string | null
          job_page_logo_border?: boolean
          job_page_logo_height?: number
          job_page_logo_padding?: number
          job_page_logo_radius?: number
          job_page_logo_shadow?: boolean
          job_page_logo_url?: string | null
          job_page_requirements_title_ar?: string | null
          job_page_requirements_title_en?: string | null
          job_page_show_brand_text?: boolean
          jobs_completed_label_ar?: string | null
          jobs_completed_label_en?: string | null
          jobs_group_by_location?: boolean | null
          jobs_other_label_ar?: string | null
          jobs_other_label_en?: string | null
          jobs_section_title_ar?: string | null
          jobs_section_title_en?: string | null
          jobs_show_completed?: boolean | null
          logo_alignment?: string | null
          logo_bg_color?: string | null
          logo_bg_color_mobile?: string | null
          logo_bg_enabled?: boolean | null
          logo_border?: boolean
          logo_border_radius?: string | null
          logo_border_radius_mobile?: string | null
          logo_fit?: string
          logo_height?: string | null
          logo_height_mobile?: number | null
          logo_offset_x?: number
          logo_offset_y?: number
          logo_padding?: number
          logo_padding_mobile?: number | null
          logo_rotation?: number
          logo_shadow?: boolean
          logo_url?: string | null
          logo_width?: number | null
          logo_width_mobile?: number | null
          primary_color?: string | null
          public_theme_palette?: string
          projects_count?: string | null
          show_nationality_on_jobs?: boolean
          show_projects_section?: boolean | null
          show_stats_section?: boolean | null
          site_name_ar?: string | null
          site_name_en?: string | null
          stats_bg_color?: string | null
          stats_section_title_ar?: string | null
          stats_section_title_en?: string | null
          success_desc_ar?: string | null
          success_desc_en?: string | null
          success_title_ar?: string | null
          success_title_en?: string | null
          training_page_desc_ar?: string | null
          training_page_desc_en?: string | null
          training_page_title_ar?: string | null
          training_page_title_en?: string | null
          two_factor_enabled?: boolean
          ui_styles?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      system_doctor_runs: {
        Row: {
          analyzed_count: number
          client_error_count: number
          created_at: string
          health_score: number | null
          id: string
          issues: Json
          recommendations: Json
          summary: string | null
          triggered_by: string
          triggered_by_user: string | null
        }
        Insert: {
          analyzed_count?: number
          client_error_count?: number
          created_at?: string
          health_score?: number | null
          id?: string
          issues?: Json
          recommendations?: Json
          summary?: string | null
          triggered_by?: string
          triggered_by_user?: string | null
        }
        Update: {
          analyzed_count?: number
          client_error_count?: number
          created_at?: string
          health_score?: number | null
          id?: string
          issues?: Json
          recommendations?: Json
          summary?: string | null
          triggered_by?: string
          triggered_by_user?: string | null
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          created_at: string
          granted: boolean
          id: string
          permission_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          granted?: boolean
          id?: string
          permission_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          granted?: boolean
          id?: string
          permission_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      value_synonyms: {
        Row: {
          canonical_ar: string
          canonical_en: string | null
          created_at: string
          field_name: string
          id: string
          is_active: boolean
          synonyms: string[]
          updated_at: string
        }
        Insert: {
          canonical_ar: string
          canonical_en?: string | null
          created_at?: string
          field_name: string
          id?: string
          is_active?: boolean
          synonyms?: string[]
          updated_at?: string
        }
        Update: {
          canonical_ar?: string
          canonical_en?: string | null
          created_at?: string
          field_name?: string
          id?: string
          is_active?: boolean
          synonyms?: string[]
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      recruitment_job_title_stats: {
        Row: {
          awaiting_count: number | null
          hired_count: number | null
          interviewed_count: number | null
          is_active: boolean | null
          is_published_to_board: boolean | null
          job_title_id: string | null
          offer_accepted_count: number | null
          offer_sent_count: number | null
          offer_signed_count: number | null
          project_id: string | null
          project_name_ar: string | null
          project_name_en: string | null
          rejected_count: number | null
          remaining_gap: number | null
          selected_count: number | null
          started_count: number | null
          target_headcount: number | null
          title_ar: string | null
          title_en: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recruitment_job_titles_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "recruitment_projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      am_i_primary_admin: { Args: never; Returns: boolean }
      cleanup_expired_trash: { Args: never; Returns: number }
      current_user_email: { Args: never; Returns: string }
      find_duplicate_applicant: {
        Args: { _email: string; _full_name: string; _phone: string }
        Returns: {
          created_at: string
          desired_position: string
          email: string
          full_name: string
          id: string
          phone: string
        }[]
      }
      get_executive_recruitment: { Args: { p_token: string }; Returns: Json }
      has_permission: {
        Args: { _permission: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_hr: { Args: { _user_id: string }; Returns: boolean }
      notify_admins: {
        Args: {
          _body: string
          _link?: string
          _metadata?: Json
          _severity?: string
          _title: string
          _type: string
        }
        Returns: number
      }
      restore_deleted_item: { Args: { _deleted_id: string }; Returns: Json }
      track_application_status: {
        Args: { _email: string; _phone: string }
        Returns: {
          created_at: string
          desired_position: string
          id: string
          status: Database["public"]["Enums"]["applicant_status"]
          updated_at: string
        }[]
      }
      update_existing_application: {
        Args: {
          _applicant_id: string
          _email: string
          _full_name: string
          _payload: Json
          _phone: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "hr_manager"
        | "recruitment_coordinator"
        | "project_manager"
      applicant_status:
        | "new"
        | "reviewing"
        | "phone_interview"
        | "in_person_interview"
        | "accepted"
        | "hired"
        | "rejected"
        | "withdrawn"
      recruitment_status:
        | "new"
        | "interviewed"
        | "selected"
        | "offer_accepted"
        | "hired"
        | "rejected"
        | "offer_sent"
        | "offer_signed"
        | "started"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "hr_manager",
        "recruitment_coordinator",
        "project_manager",
      ],
      applicant_status: [
        "new",
        "reviewing",
        "phone_interview",
        "in_person_interview",
        "accepted",
        "hired",
        "rejected",
        "withdrawn",
      ],
      recruitment_status: [
        "new",
        "interviewed",
        "selected",
        "offer_accepted",
        "hired",
        "rejected",
        "offer_sent",
        "offer_signed",
        "started",
      ],
    },
  },
} as const
