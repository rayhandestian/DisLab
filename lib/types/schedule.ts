import type { SupabaseClient } from '@supabase/supabase-js'
import type { BuilderStateSnapshot, WebhookMessagePayload, StoredFileAttachment } from '@/lib/webhookSerializer'

// Recurrence pattern types
export type RecurrencePattern = 'once' | 'daily' | 'weekly' | 'monthly' | 'custom'

// Configuration for different recurrence patterns
export type RecurrenceConfig = {
   // For once pattern
   datetime?: string // ISO 8601 datetime string for one-time execution

   // For daily pattern
   time?: string // "HH:mm" format (24-hour)

   // For weekly pattern
   days?: number[] // 0-6, where 0 is Sunday, 1 is Monday, etc.

   // For monthly pattern
   day?: number // 1-31, day of month

   // For custom pattern
   cronExpression?: string // Standard cron format

   // Common fields
   timezone?: string // IANA timezone (e.g., "Asia/Jakarta")
}

// Extended schedule row type
export type ScheduleRow = {
  id: string
  user_id: string
  name: string
  webhook_url: string
  saved_webhook_id?: string
  message_data?: WebhookMessagePayload // Keep for backward compatibility
  builder_state?: BuilderStateSnapshot // Keep for backward compatibility
  files?: StoredFileAttachment[] // Keep for backward compatibility

  // Scheduling fields
  schedule_time: string // ISO 8601 timestamp
  is_recurring: boolean
  recurrence_pattern?: RecurrencePattern
  cron_expression?: string
  recurrence_config?: RecurrenceConfig

  // Execution tracking
  is_active: boolean
  last_executed_at?: string
  next_execution_at?: string
  execution_count: number
  max_executions?: number

  // Metadata
  created_at: string
  updated_at: string
}

// Saved webhook row type
export type SavedWebhookRow = {
  id: string
  user_id: string
  name: string
  message_data?: WebhookMessagePayload
  builder_state?: BuilderStateSnapshot
  files?: StoredFileAttachment[]

  // Metadata
  created_at: string
  updated_at: string
}

// Saved webhook creation parameters
export type CreateSavedWebhookParams = {
  supabase: SupabaseClient
  userId: string
  name: string
  snapshot: BuilderStateSnapshot
  files?: File[]
}

// Saved webhook update parameters
export type UpdateSavedWebhookParams = {
  supabase: SupabaseClient
  webhookId: string
  userId: string
  name: string
  snapshot: BuilderStateSnapshot
  retainedFiles?: StoredFileAttachment[]
  filesToRemove?: StoredFileAttachment[]
  newFiles?: File[]
}

// Natural language parsing result
export type ParsedSchedule = {
  pattern: RecurrencePattern
  config: RecurrenceConfig
  cronExpression?: string
  description: string // Human-readable description
}

// Schedule creation parameters
export type CreateScheduleParams = {
  supabase: SupabaseClient
  userId: string
  name: string
  webhookUrl: string
  savedWebhookId: string
  scheduleTime: Date | string

  // Recurrence fields
  isRecurring?: boolean
  recurrencePattern?: RecurrencePattern
  recurrenceConfig?: RecurrenceConfig
  maxExecutions?: number
}

// Schedule update parameters
export type UpdateScheduleParams = {
  supabase: SupabaseClient
  scheduleId: string
  userId: string
  name: string
  webhookUrl: string
  savedWebhookId: string
  scheduleTime: Date | string
  isActive?: boolean

  // Recurrence fields
  isRecurring?: boolean
  recurrencePattern?: RecurrencePattern
  recurrenceConfig?: RecurrenceConfig
  maxExecutions?: number
}