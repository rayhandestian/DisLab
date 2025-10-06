import type { SupabaseClient } from '@supabase/supabase-js'

import {
  createScheduleInsertPayload,
  createWebhookMessagePayload,
  type BuilderStateSnapshot,
  type ScheduleInsertPayload,
  type StoredFileAttachment,
} from '@/lib/webhookSerializer'

import type {
  RecurrencePattern,
  RecurrenceConfig,
  ScheduleRow as ScheduleRowType,
  CreateScheduleParams as CreateScheduleParamsType,
  UpdateScheduleParams as UpdateScheduleParamsType,
} from '@/lib/types/schedule'

import { getSavedWebhookById } from '@/lib/savedWebhookService'

export type { StoredFileAttachment } from '@/lib/webhookSerializer'
export type { ScheduleRow, RecurrencePattern, RecurrenceConfig } from '@/lib/types/schedule'

export const SCHEDULES_TABLE = 'schedules'
export const SCHEDULE_FILES_BUCKET = 'webhook-files'

const generateId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`)

const sanitizeFileName = (name: string) => name.replace(/[^a-zA-Z0-9.\-_]/g, '_')

const buildStoragePath = (userId: string, scheduleId: string, index: number, fileName: string) => {
  const safeName = sanitizeFileName(fileName)
  return `users/${userId}/schedules/${scheduleId}/${Date.now()}-${index}-${safeName}`
}

export type UploadFilesParams = {
  supabase: SupabaseClient
  userId: string
  scheduleId: string
  files: File[]
}

export const uploadScheduleFiles = async ({ supabase, userId, scheduleId, files }: UploadFilesParams): Promise<StoredFileAttachment[]> => {
  if (!files || files.length === 0) return []

  const uploaded: StoredFileAttachment[] = []
  try {
    for (const [index, file] of files.entries()) {
      const storagePath = buildStoragePath(userId, scheduleId, index, file.name)
      const { error } = await supabase.storage.from(SCHEDULE_FILES_BUCKET).upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false,
      })

      if (error) {
        throw error
      }

      uploaded.push({
        name: file.name,
        size: file.size,
        mimeType: file.type,
        storagePath,
        originalIndex: index,
      })
    }
    return uploaded
  } catch (error) {
    if (uploaded.length > 0) {
      void supabase.storage.from(SCHEDULE_FILES_BUCKET).remove(uploaded.map(file => file.storagePath))
    }
    throw error
  }
}

export const removeScheduleFiles = async (supabase: SupabaseClient, files?: StoredFileAttachment[]) => {
  if (!files || files.length === 0) return
  await supabase.storage.from(SCHEDULE_FILES_BUCKET).remove(files.map(file => file.storagePath))
}

export type CreateScheduleParams = CreateScheduleParamsType

export const createSchedule = async ({
  supabase,
  userId,
  name,
  webhookUrl,
  savedWebhookId,
  scheduleTime,
  isRecurring = false,
  recurrencePattern = 'once',
  recurrenceConfig,
  maxExecutions,
}: CreateScheduleParams): Promise<ScheduleRowType> => {
  // Check limit: max 3 active schedules per user
  const { count, error: countError } = await supabase
    .from(SCHEDULES_TABLE)
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_active', true)

  if (countError) {
    throw countError
  }

  if (count && count >= 3) {
    throw new Error('Maximum 3 active schedules allowed per user')
  }

  const scheduleId = generateId()

  // Fetch the saved webhook data
  const savedWebhook = await getSavedWebhookById(supabase, userId, savedWebhookId)

  // Calculate next_execution_at
  // For cron schedules with * * * * * (every minute), start immediately
  let nextExecutionAt: string
  if (isRecurring && recurrencePattern === 'cron' && recurrenceConfig?.cronExpression === '* * * * *') {
    // Start immediately for every-minute schedules
    nextExecutionAt = new Date().toISOString()
  } else {
    // Use the provided schedule time
    nextExecutionAt = typeof scheduleTime === 'string'
      ? new Date(scheduleTime).toISOString()
      : scheduleTime.toISOString()
  }

  const { data, error } = await supabase
    .from(SCHEDULES_TABLE)
    .insert({
      id: scheduleId,
      user_id: userId,
      name,
      webhook_url: webhookUrl,
      saved_webhook_id: savedWebhookId,
      message_data: savedWebhook.message_data,
      builder_state: savedWebhook.builder_state,
      files: savedWebhook.files,
      schedule_time: typeof scheduleTime === 'string' ? new Date(scheduleTime).toISOString() : scheduleTime.toISOString(),
      is_recurring: isRecurring,
      recurrence_pattern: recurrencePattern,
      recurrence_config: recurrenceConfig,
      cron_expression: recurrencePattern === 'cron' ? recurrenceConfig?.cronExpression : null,
      next_execution_at: nextExecutionAt,
      max_executions: maxExecutions,
      execution_count: 0,
    })
    .select()
    .single()

  if (error) {
    throw error
  }

  return data as ScheduleRowType
}

export type UpdateScheduleParams = UpdateScheduleParamsType

export const updateSchedule = async ({
  supabase,
  scheduleId,
  userId,
  name,
  webhookUrl,
  savedWebhookId,
  scheduleTime,
  isActive = true,
  isRecurring = false,
  recurrencePattern = 'once',
  recurrenceConfig,
  maxExecutions,
}: UpdateScheduleParams): Promise<ScheduleRowType> => {
  // Fetch the saved webhook data
  const savedWebhook = await getSavedWebhookById(supabase, userId, savedWebhookId)

  const isoScheduleTime = typeof scheduleTime === 'string' ? new Date(scheduleTime).toISOString() : scheduleTime.toISOString()

  const { data, error } = await supabase
    .from(SCHEDULES_TABLE)
    .update({
      name,
      webhook_url: webhookUrl,
      saved_webhook_id: savedWebhookId,
      message_data: savedWebhook.message_data,
      builder_state: savedWebhook.builder_state,
      files: savedWebhook.files,
      schedule_time: isoScheduleTime,
      is_active: isActive,
      is_recurring: isRecurring,
      recurrence_pattern: recurrencePattern,
      recurrence_config: recurrenceConfig,
      cron_expression: recurrencePattern === 'cron' ? recurrenceConfig?.cronExpression : null,
      next_execution_at: isoScheduleTime,
      max_executions: maxExecutions,
      updated_at: new Date().toISOString(),
    })
    .eq('id', scheduleId)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    throw error
  }

  return data as ScheduleRowType
}

export type DeleteScheduleParams = {
  supabase: SupabaseClient
  scheduleId: string
  userId: string
}

export const deleteSchedule = async ({ supabase, scheduleId, userId }: DeleteScheduleParams) => {
  const { data, error } = await supabase
    .from(SCHEDULES_TABLE)
    .delete()
    .eq('id', scheduleId)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    throw error
  }

  const deletedRow = data as ScheduleRowType | null
  if (deletedRow?.files?.length) {
    void removeScheduleFiles(supabase, deletedRow.files)
  }

  return deletedRow
}

export const fetchSchedules = async (supabase: SupabaseClient, userId: string) => {
  const { data, error } = await supabase
    .from(SCHEDULES_TABLE)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  return (data ?? []) as ScheduleRowType[]
}

export const getScheduleById = async (supabase: SupabaseClient, userId: string, scheduleId: string) => {
  const { data, error } = await supabase
    .from(SCHEDULES_TABLE)
    .select('*')
    .eq('user_id', userId)
    .eq('id', scheduleId)
    .single()

  if (error) {
    throw error
  }

  return data as ScheduleRowType
}

/**
 * Calculate the next execution time for a recurring schedule
 */
export function calculateNextExecution(
  pattern: RecurrencePattern,
  config: RecurrenceConfig,
  fromDate: Date = new Date()
): Date {
  switch (pattern) {
    case 'once':
      return fromDate

    case 'cron':
      // For cron schedules, we need to calculate the next execution based on the cron expression
      // This is a simplified implementation - in production, you'd want a full cron parser
      if (config.cronExpression) {
        // For now, return the next minute for testing
        // In the backend, this will be handled by the cron parser
        const next = new Date(fromDate)
        next.setMinutes(next.getMinutes() + 1)
        return next
      }
      // Fallback
      const next = new Date(fromDate)
      next.setDate(next.getDate() + 1)
      return next

    default:
      // Fallback for unknown patterns
      const fallback = new Date(fromDate)
      fallback.setDate(fallback.getDate() + 1)
      return fallback
  }
}

/**
 * Check if a schedule should continue executing
 */
export function shouldContinueExecution(schedule: ScheduleRowType): boolean {
  if (!schedule.is_recurring) return false
  if (!schedule.is_active) return false
  if (schedule.max_executions && schedule.execution_count >= schedule.max_executions) {
    return false
  }
  return true
}

export const createSignedFileUrl = async (supabase: SupabaseClient, file: StoredFileAttachment, expiresInSeconds = 60) => {
  const { data, error } = await supabase.storage
    .from(SCHEDULE_FILES_BUCKET)
    .createSignedUrl(file.storagePath, expiresInSeconds)

  if (error) {
    throw error
  }

  return data?.signedUrl ?? null
}