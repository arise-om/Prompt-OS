/*
 * Generated from the live Prompt OS Supabase schema; synchronized with workflow run and promotion state on 2026-10-03.
 * Keep this file synchronized with Supabase whenever the public schema changes.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      domains: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          is_system: boolean;
          name: string;
          owner_user_id: string | null;
          slug: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_system?: boolean;
          name: string;
          owner_user_id?: string | null;
          slug: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_system?: boolean;
          name?: string;
          owner_user_id?: string | null;
          slug?: string;
        };
        Relationships: [];
      };
      prompt_versions: {
        Row: {
          audit_findings: Json;
          audit_missing_sections: Json;
          audit_score: number | null;
          body: string;
          change_summary: string | null;
          constraints: Json;
          created_at: string;
          evaluation_criteria: Json;
          expected_output: string | null;
          id: string;
          optional_context: Json;
          parent_version_id: string | null;
          prompt_id: string;
          required_context: Json;
          variables: Json;
          version: string;
        };
        Insert: {
          audit_findings?: Json;
          audit_missing_sections?: Json;
          audit_score?: number | null;
          body: string;
          change_summary?: string | null;
          constraints?: Json;
          created_at?: string;
          evaluation_criteria?: Json;
          expected_output?: string | null;
          id?: string;
          optional_context?: Json;
          parent_version_id?: string | null;
          prompt_id: string;
          required_context?: Json;
          variables?: Json;
          version: string;
        };
        Update: {
          audit_findings?: Json;
          audit_missing_sections?: Json;
          audit_score?: number | null;
          body?: string;
          change_summary?: string | null;
          constraints?: Json;
          created_at?: string;
          evaluation_criteria?: Json;
          expected_output?: string | null;
          id?: string;
          optional_context?: Json;
          parent_version_id?: string | null;
          prompt_id?: string;
          required_context?: Json;
          version?: string;
        };
        Relationships: [
          {
            foreignKeyName: "prompt_versions_parent_version_id_fkey";
            columns: ["parent_version_id"];
            isOneToOne: false;
            referencedRelation: "prompt_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "prompt_versions_prompt_id_fkey";
            columns: ["prompt_id"];
            isOneToOne: false;
            referencedRelation: "prompts";
            referencedColumns: ["id"];
          }
        ];
      };
      evaluation_runs: {
        Row: {
          actual_output: Json;
          benchmark_case_id: string | null;
          created_at: string;
          failure_codes: string[];
          id: string;
          owner_user_id: string;
          prompt_audit_snapshot: Json | null;
          prompt_version_id: string | null;
          reviewer_notes: string | null;
          scores: Json;
          workflow_id: string | null;
          workflow_version: string | null;
        };
        Insert: {
          actual_output: Json;
          benchmark_case_id?: string | null;
          created_at?: string;
          failure_codes?: string[];
          id?: string;
          owner_user_id: string;
          prompt_audit_snapshot?: Json | null;
          prompt_version_id?: string | null;
          reviewer_notes?: string | null;
          scores?: Json;
          workflow_id?: string | null;
          workflow_version?: string | null;
        };
        Update: {
          actual_output?: Json;
          benchmark_case_id?: string | null;
          created_at?: string;
          failure_codes?: string[];
          id?: string;
          owner_user_id?: string;
          prompt_audit_snapshot?: Json | null;
          prompt_version_id?: string | null;
          reviewer_notes?: string | null;
          scores?: Json;
          workflow_id?: string | null;
          workflow_version?: string | null;
        };
        Relationships: [];
      };
      benchmark_cases: {
        Row: {
          category: string;
          created_at: string;
          expected_characteristics: Json;
          golden_output: Json | null;
          id: string;
          input: Json;
          is_system: boolean;
          name: string;
          owner_user_id: string | null;
          updated_at: string;
        };
        Insert: {
          category: string;
          created_at?: string;
          expected_characteristics?: Json;
          golden_output?: Json | null;
          id?: string;
          input: Json;
          is_system?: boolean;
          name: string;
          owner_user_id?: string | null;
          updated_at?: string;
        };
        Update: {
          category?: string;
          created_at?: string;
          expected_characteristics?: Json;
          golden_output?: Json | null;
          id?: string;
          input?: Json;
          is_system?: boolean;
          name?: string;
          owner_user_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      evaluation_criteria: {
        Row: {
          created_at: string;
          description: string;
          id: string;
          is_system: boolean;
          name: string;
          owner_user_id: string | null;
          scoring_type: string;
          weight: number;
        };
        Insert: {
          created_at?: string;
          description: string;
          id?: string;
          is_system?: boolean;
          name: string;
          owner_user_id?: string | null;
          scoring_type?: string;
          weight?: number;
        };
        Update: {
          created_at?: string;
          description?: string;
          id?: string;
          is_system?: boolean;
          name?: string;
          owner_user_id?: string | null;
          scoring_type?: string;
          weight?: number;
        };
        Relationships: [];
      };
      benchmark_case_criteria: {
        Row: {
          benchmark_case_id: string;
          criterion_id: string;
          weight_override: number | null;
        };
        Insert: {
          benchmark_case_id: string;
          criterion_id: string;
          weight_override?: number | null;
        };
        Update: {
          benchmark_case_id?: string;
          criterion_id?: string;
          weight_override?: number | null;
        };
        Relationships: [];
      };
      workflows: {
        Row: {
          approval_required: boolean;
          created_at: string;
          description: string | null;
          id: string;
          is_system: boolean;
          name: string;
          owner_user_id: string | null;
          project_id: string | null;
          status: string;
          trigger: string | null;
          updated_at: string;
          version: string;
        };
        Insert: {
          approval_required?: boolean;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_system?: boolean;
          name: string;
          owner_user_id?: string | null;
          project_id?: string | null;
          status?: string;
          trigger?: string | null;
          updated_at?: string;
          version?: string;
        };
        Update: {
          approval_required?: boolean;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_system?: boolean;
          name?: string;
          owner_user_id?: string | null;
          project_id?: string | null;
          status?: string;
          trigger?: string | null;
          updated_at?: string;
          version?: string;
        };
        Relationships: [];
      };
      workflow_steps: {
        Row: {
          config: Json;
          id: string;
          input_keys: Json;
          name: string;
          output_keys: Json;
          position: number;
          purpose: string;
          step_type: string;
          workflow_id: string;
        };
        Insert: {
          config?: Json;
          id?: string;
          input_keys?: Json;
          name: string;
          output_keys?: Json;
          position: number;
          purpose: string;
          step_type: string;
          workflow_id: string;
        };
        Update: {
          config?: Json;
          id?: string;
          input_keys?: Json;
          name?: string;
          output_keys?: Json;
          position?: number;
          purpose?: string;
          step_type?: string;
          workflow_id?: string;
        };
        Relationships: [];
      };
      workflow_edges: {
        Row: {
          condition: Json;
          created_at: string;
          from_step_id: string;
          id: string;
          priority: number;
          to_step_id: string;
          workflow_id: string;
        };
        Insert: {
          condition?: Json;
          created_at?: string;
          from_step_id: string;
          id?: string;
          priority?: number;
          to_step_id: string;
          workflow_id: string;
        };
        Update: {
          condition?: Json;
          created_at?: string;
          from_step_id?: string;
          id?: string;
          priority?: number;
          to_step_id?: string;
          workflow_id?: string;
        };
        Relationships: [];
      };
      workflow_promotions: {
        Row: {
          average_score: number;
          created_at: string;
          distinct_benchmark_count: number;
          evaluation_run_count: number;
          failed_run_count: number;
          from_status: string;
          id: string;
          owner_user_id: string;
          to_status: string;
          workflow_id: string;
          workflow_version: string;
        };
        Insert: {
          average_score: number;
          created_at?: string;
          distinct_benchmark_count: number;
          evaluation_run_count: number;
          failed_run_count: number;
          from_status: string;
          id?: string;
          owner_user_id: string;
          to_status: string;
          workflow_id: string;
          workflow_version: string;
        };
        Update: {
          average_score?: number;
          created_at?: string;
          distinct_benchmark_count?: number;
          evaluation_run_count?: number;
          failed_run_count?: number;
          from_status?: string;
          id?: string;
          owner_user_id?: string;
          to_status?: string;
          workflow_id?: string;
          workflow_version?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workflow_promotions_workflow_id_fkey";
            columns: ["workflow_id"];
            isOneToOne: false;
            referencedRelation: "workflows";
            referencedColumns: ["id"];
          }
        ];
      };
      workflow_runs: {
        Row: {
          completed_at: string | null;
          created_at: string;
          current_step_id: string | null;
          failure: Json | null;
          id: string;
          owner_user_id: string;
          pending_approval: Json | null;
          state: Json;
          status: string;
          updated_at: string;
          workflow_id: string;
          workflow_version: string;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          current_step_id?: string | null;
          failure?: Json | null;
          id?: string;
          owner_user_id: string;
          pending_approval?: Json | null;
          state?: Json;
          status: string;
          updated_at?: string;
          workflow_id: string;
          workflow_version: string;
        };
        Update: {
          completed_at?: string | null;
          current_step_id?: string | null;
          failure?: Json | null;
          id?: string;
          owner_user_id?: string;
          pending_approval?: Json | null;
          state?: Json;
          status?: string;
          updated_at?: string;
          workflow_id?: string;
          workflow_version?: string;
        };
        Relationships: [];
      };
      prompts: {
        Row: {
          complexity: number;
          created_at: string;
          description: string | null;
          domain_id: string | null;
          id: string;
          intent: string;
          is_system: boolean;
          name: string;
          owner_user_id: string | null;
          project_id: string | null;
          status: string;
          tags: string[];
          updated_at: string;
        };
        Insert: {
          complexity?: number;
          created_at?: string;
          description?: string | null;
          domain_id?: string | null;
          id?: string;
          intent: string;
          is_system?: boolean;
          name: string;
          owner_user_id?: string | null;
          project_id?: string | null;
          status?: string;
          tags?: string[];
          updated_at?: string;
        };
        Update: {
          complexity?: number;
          created_at?: string;
          description?: string | null;
          domain_id?: string | null;
          id?: string;
          intent?: string;
          is_system?: boolean;
          name?: string;
          owner_user_id?: string | null;
          project_id?: string | null;
          status?: string;
          tags?: string[];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "prompts_domain_id_fkey";
            columns: ["domain_id"];
            isOneToOne: false;
            referencedRelation: "domains";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      create_prompt_clone: {
        Args: {
          p_audit_findings: Json;
          p_audit_missing_sections: Json;
          p_audit_score: number;
          p_body: string;
          p_complexity: number;
          p_constraints: Json;
          p_description: string;
          p_domain_slug: string;
          p_evaluation_criteria: Json;
          p_expected_output: string;
          p_intent: string;
          p_name: string;
          p_optional_context: Json;
          p_required_context: Json;
          p_variables: Json;
        };
        Returns: string;
      };
      promote_workflow: {
        Args: {
          p_expected_version: string;
          p_min_benchmarks?: number;
          p_min_runs?: number;
          p_min_score?: number;
          p_workflow_id: string;
        };
        Returns: string;
      };
      create_workflow_clone: {
        Args: {
          p_name?: string | null
          p_source_workflow_id: string
        }
        Returns: string
      }
      create_workflow_run: {
        Args: {
          p_current_step_id: string | null;
          p_failure: Json | null;
          p_pending_approval: Json | null;
          p_state: Json;
          p_status: string;
          p_workflow_id: string;
        };
        Returns: string;
      };
      update_workflow_run: {
        Args: {
          p_current_step_id: string | null;
          p_failure: Json | null;
          p_pending_approval: Json | null;
          p_run_id: string;
          p_state: Json;
          p_status: string;
        };
        Returns: undefined;
      };
      create_evaluation_run: {
        Args: {
          p_actual_output: Json;
          p_benchmark_case_id: string | null;
          p_failure_codes: string[];
          p_prompt_version_id: string | null;
          p_reviewer_notes: string | null;
          p_scores: Json;
          p_workflow_id: string | null;
        };
        Returns: string;
      };
      create_prompt_version: {
        Args: {
          p_audit_findings: Json;
          p_audit_missing_sections: Json;
          p_audit_score: number;
          p_body: string;
          p_change_summary: string;
          p_constraints: Json;
          p_description: string;
          p_evaluation_criteria: Json;
          p_expected_output: string;
          p_name: string;
          p_optional_context: Json;
          p_prompt_id: string;
          p_required_context: Json;
          p_variables: Json;
        };
        Returns: string;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Tables<TableName extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][TableName]["Row"];
