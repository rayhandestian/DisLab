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
  scheduleTime,
  snapshot,
  files,
  isRecurring = false,
  recurrencePattern = 'once',
  recurrenceConfig,
  maxExecutions,
}: CreateScheduleParams): Promise<ScheduleRowType> => {
  const scheduleId = generateId()
  const uploadedFiles = files?.length
    ? await uploadScheduleFiles({ supabase, userId, scheduleId, files })
    : []

  const snapshotWithFiles: BuilderStateSnapshot = {
    ...snapshot,
    files: uploadedFiles,
  }

  const insertPayload: ScheduleInsertPayload = createScheduleInsertPayload({
    userId,
    name,
    webhookUrl,
    scheduleTime,
    snapshot: snapshotWithFiles,
    files: uploadedFiles,
  })

  // Calculate next_execution_at
  const nextExecutionAt = typeof scheduleTime === 'string'
    ? new Date(scheduleTime).toISOString()
    : scheduleTime.toISOString()

  const { data, error } = await supabase
    .from(SCHEDULES_TABLE)
    .insert({
      id: scheduleId,
      ...insertPayload,
      is_recurring: isRecurring,
      recurrence_pattern: recurrencePattern,
      recurrence_config: recurrenceConfig,
      next_execution_at: nextExecutionAt,
      max_executions: maxExecutions,
      execution_count: 0,
    })
    .select()
    .single()

  if (error) {
    if (uploadedFiles.length > 0) {
      void removeScheduleFiles(supabase, uploadedFiles)
    }
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
  scheduleTime,
  snapshot,
  retainedFiles = [],
  filesToRemove = [],
  newFiles,
  isActive = true,
  isRecurring = false,
  recurrencePattern = 'once',
  recurrenceConfig,
  maxExecutions,
}: UpdateScheduleParams): Promise<ScheduleRowType> => {
  const uploadedFiles = newFiles?.length
    ? await uploadScheduleFiles({ supabase, userId, scheduleId, files: newFiles })
    : []

  const nextFiles = [...retainedFiles, ...uploadedFiles]

  const snapshotWithFiles: BuilderStateSnapshot = {
    ...snapshot,
    files: nextFiles,
  }

  const isoScheduleTime = typeof scheduleTime === 'string' ? new Date(scheduleTime).toISOString() : scheduleTime.toISOString()
  const messagePayload = createWebhookMessagePayload(snapshotWithFiles)

  const { data, error} = await supabase
    .from(SCHEDULES_TABLE)
    .update({
      name,
      webhook_url: webhookUrl,
      schedule_time: isoScheduleTime,
      message_data: messagePayload,
      builder_state: snapshotWithFiles,
      files: nextFiles,
      is_active: isActive,
      is_recurring: isRecurring,
      recurrence_pattern: recurrencePattern,
      recurrence_config: recurrenceConfig,
      next_execution_at: isoScheduleTime,
      max_executions: maxExecutions,
      updated_at: new Date().toISOString(),
    })
    .eq('id', scheduleId)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    if (uploadedFiles.length > 0) {
      void removeScheduleFiles(supabase, uploadedFiles)
    }
    throw error
  }

  if (filesToRemove.length > 0) {
    void removeScheduleFiles(supabase, filesToRemove)
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
  const next = new Date(fromDate)
  
  switch (pattern) {
    case 'once':
      return next
      
    case 'daily':
      next.setDate(next.getDate() + 1)
      if (config.time) {
        const [hours, minutes] = config.time.split(':').map(Number)
        next.setHours(hours, minutes, 0, 0)
      }
      break
      
    case 'weekly':
      if (config.days && config.days.length > 0) {
        const currentDay = next.getDay()
        const sortedDays = [...config.days].sort()
        
        // Find next day in the week
        let nextDay = sortedDays.find(d => d > currentDay)
        
        if (nextDay === undefined) {
          // Wrap to next week
          nextDay = sortedDays[0]
          next.setDate(next.getDate() + (7 - currentDay + nextDay))
        } else {
          next.setDate(next.getDate() + (nextDay - currentDay))
        }
        
        if (config.time) {
          const [hours, minutes] = config.time.split(':').map(Number)
          next.setHours(hours, minutes, 0, 0)
        }
      }
      break
      
    case 'monthly':
      next.setMonth(next.getMonth() + 1)
      if (config.day) {
        next.setDate(config.day)
      }
      if (config.time) {
        const [hours, minutes] = config.time.split(':').map(Number)
        next.setHours(hours, minutes, 0, 0)
      }
      break
      
    case 'custom':
      // For custom cron, this would need a proper cron parser
      // For now, default to +1 day
      next.setDate(next.getDate() + 1)
      break
  }
  
  return next
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