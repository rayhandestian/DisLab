import type { SupabaseClient } from '@supabase/supabase-js'

import {
  createScheduleInsertPayload,
  createWebhookMessagePayload,
  type BuilderStateSnapshot,
  type ScheduleInsertPayload,
  type StoredFileAttachment,
  type WebhookMessagePayload,
} from '@/lib/webhookSerializer'

export type { StoredFileAttachment } from '@/lib/webhookSerializer'

export const SCHEDULES_TABLE = 'schedules'
export const SCHEDULE_FILES_BUCKET = 'webhook-files'

export type ScheduleRow = {
  id: string
  user_id: string
  name: string
  webhook_url: string
  message_data: WebhookMessagePayload
  schedule_time: string
  is_active: boolean
  created_at: string
  updated_at: string
  builder_state?: BuilderStateSnapshot
  files?: StoredFileAttachment[]
}

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

export type CreateScheduleParams = {
  supabase: SupabaseClient
  userId: string
  name: string
  webhookUrl: string
  scheduleTime: Date | string
  snapshot: BuilderStateSnapshot
  files?: File[]
}

export const createSchedule = async ({
  supabase,
  userId,
  name,
  webhookUrl,
  scheduleTime,
  snapshot,
  files,
}: CreateScheduleParams): Promise<ScheduleRow> => {
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

  const { data, error } = await supabase
    .from(SCHEDULES_TABLE)
    .insert({
      id: scheduleId,
      ...insertPayload,
    })
    .select()
    .single()

  if (error) {
    if (uploadedFiles.length > 0) {
      void removeScheduleFiles(supabase, uploadedFiles)
    }
    throw error
  }

  return data as ScheduleRow
}

export type UpdateScheduleParams = {
  supabase: SupabaseClient
  scheduleId: string
  userId: string
  name: string
  webhookUrl: string
  scheduleTime: Date | string
  snapshot: BuilderStateSnapshot
  retainedFiles?: StoredFileAttachment[]
  filesToRemove?: StoredFileAttachment[]
  newFiles?: File[]
  isActive?: boolean
}

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
}: UpdateScheduleParams): Promise<ScheduleRow> => {
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

  const { data, error } = await supabase
    .from(SCHEDULES_TABLE)
    .update({
      name,
      webhook_url: webhookUrl,
      schedule_time: isoScheduleTime,
      message_data: messagePayload,
      builder_state: snapshotWithFiles,
      files: nextFiles,
      is_active: isActive,
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

  return data as ScheduleRow
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

  const deletedRow = data as ScheduleRow | null
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

  return (data ?? []) as ScheduleRow[]
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

  return data as ScheduleRow
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