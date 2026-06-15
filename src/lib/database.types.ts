// Hand-written DB row types mirroring supabase/migrations.
// (Regenerate with `supabase gen types typescript` once the project is linked.)

import type { Location, Role } from '@/engine/types';

export type AppRole = 'editor' | 'viewer';

export type StaffRow = {
  id: string;
  name: string;
  display_name: string;
  role: Role;
  priority_rank: number | null;
  mod_priority: number | null;
  in_ma_pool: boolean;
  can_social_media: boolean;
  can_pcc: boolean;
  can_shipping: boolean;
  receives_mas: boolean;
  needs_pcc: boolean;
  needs_coverage_when_out: boolean;
  can_cover_providers: boolean;
  active: boolean;
}

export type MonthlyPatternRow = {
  id: string;
  staff_id: string;
  month: string;
  usual_weekdays: number[];
  location_by_weekday: Record<string, Location>;
  requested_off_days: number[];
}

export type DailyAssignmentRow = {
  id: string;
  date: string;
  staff_id: string;
  location: Location;
  is_mod: boolean;
  assigned_provider_id: string | null;
  ma_slot: number | null;
  pcc_covers_ids: string[];
  provider_coverage_ids: string[];
  is_shipping: boolean;
  is_social_media: boolean;
  custom_text: string | null;
}

export type DismissedWarningRow = {
  date: string;
  type: string;
  ref_key: string;
}

export type AppUserRow = {
  id: string;
  app_role: AppRole;
}

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

type Empty = Record<string, never>;

export interface Database {
  public: {
    Tables: {
      staff: Table<StaffRow>;
      monthly_patterns: Table<MonthlyPatternRow, Omit<MonthlyPatternRow, 'id'>>;
      daily_assignments: Table<DailyAssignmentRow, Omit<DailyAssignmentRow, 'id'>>;
      dismissed_warnings: Table<DismissedWarningRow, DismissedWarningRow>;
      app_users: Table<AppUserRow>;
    };
    Views: Empty;
    Functions: {
      is_editor: { Args: Record<string, never>; Returns: boolean };
    };
    Enums: Empty;
    CompositeTypes: Empty;
  };
}
