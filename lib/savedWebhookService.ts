import type { SupabaseClient } from '@supabase/supabase-js'

import {
  createWebhookMessagePayload,
  type BuilderStateSnapshot,
  type StoredFileAttachment,
} from '@/lib/webhookSerializer'

import type {
  SavedWebhookRow,
  CreateSavedWebhookParams,
  UpdateSavedWebhookParams,
} from '@/lib/types/schedule'

export type { SavedWebhookRow } from '@/lib/types/schedule'

export const SAVED_WEBHOOKS_TABLE = 'saved_webhooks'
export const WEBHOOK_FILES_BUCKET = 'webhook-files'

const generateId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`)

const sanitizeFileName = (name: string) => name.replace(/[^a-zA-Z0-9.\-_]/g, '_')

const buildStoragePath = (userId: string, webhookId: string, index: number, fileName: string) => {
  const safeName = sanitizeFileName(fileName)
  return `users/${userId}/webhooks/${webhookId}/${Date.now()}-${index}-${safeName}`
}

export type UploadWebhookFilesParams = {
  supabase: SupabaseClient
  userId: string
  webhookId: string
  files: File[]
}

export const uploadWebhookFiles = async ({ supabase, userId, webhookId, files }: UploadWebhookFilesParams): Promise<StoredFileAttachment[]> => {
  console.log('uploadWebhookFiles called with files:', files?.length || 0)
  if (!files || files.length === 0) return []

  const uploaded: StoredFileAttachment[] = []
  try {
    for (const [index, file] of files.entries()) {
      console.log(`Uploading file ${index}: ${file.name}, size: ${file.size}, type: ${file.type}`)
      const storagePath = buildStoragePath(userId, webhookId, index, file.name)
      console.log('Storage path:', storagePath)
      const { error } = await supabase.storage.from(WEBHOOK_FILES_BUCKET).upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false,
      })

      if (error) {
        console.error('Upload error:', error)
        throw error
      }

      console.log('Upload successful for file:', file.name)
      uploaded.push({
        name: file.name,
        size: file.size,
        mimeType: file.type,
        storagePath,
        originalIndex: index,
      })
    }
    console.log('All files uploaded successfully')
    return uploaded
  } catch (error) {
    console.error('Error in uploadWebhookFiles:', error)
    if (uploaded.length > 0) {
      console.log('Cleaning up uploaded files due to error')
      void supabase.storage.from(WEBHOOK_FILES_BUCKET).remove(uploaded.map(file => file.storagePath))
    }
    throw error
  }
}

export const removeWebhookFiles = async (supabase: SupabaseClient, files?: StoredFileAttachment[]) => {
  if (!files || files.length === 0) return
  await supabase.storage.from(WEBHOOK_FILES_BUCKET).remove(files.map(file => file.storagePath))
}

export const createSavedWebhook = async ({
  supabase,
  userId,
  name,
  snapshot,
  files,
}: CreateSavedWebhookParams): Promise<SavedWebhookRow> => {
  console.log('createSavedWebhook called with files:', files?.length || 0)
  // Check limit: max 10 saved webhooks per user
  const { count, error: countError } = await supabase
    .from(SAVED_WEBHOOKS_TABLE)
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)

  if (countError) {
    console.error('Count error:', countError)
    throw countError
  }

  if (count && count >= 10) {
    throw new Error('Maximum 10 saved webhooks allowed per user')
  }

  const webhookId = generateId()
  console.log('Generated webhookId:', webhookId)
  const uploadedFiles = files?.length
    ? await uploadWebhookFiles({ supabase, userId, webhookId, files })
    : []
  console.log('Uploaded files:', uploadedFiles.length)

  const snapshotWithFiles: BuilderStateSnapshot = {
    ...snapshot,
    files: uploadedFiles,
  }

  const messagePayload = createWebhookMessagePayload(snapshotWithFiles)
  console.log('Message payload created')

  const { data, error } = await supabase
    .from(SAVED_WEBHOOKS_TABLE)
    .insert({
      id: webhookId,
      user_id: userId,
      name,
      message_data: messagePayload,
      builder_state: snapshotWithFiles,
      files: uploadedFiles,
    })
    .select()
    .single()

  if (error) {
    console.error('Insert error:', error)
    if (uploadedFiles.length > 0) {
      void removeWebhookFiles(supabase, uploadedFiles)
    }
    throw error
  }

  console.log('Webhook saved successfully')
  return data as SavedWebhookRow
}

export const updateSavedWebhook = async ({
  supabase,
  webhookId,
  userId,
  name,
  snapshot,
  retainedFiles = [],
  filesToRemove = [],
  newFiles,
}: UpdateSavedWebhookParams): Promise<SavedWebhookRow> => {
  const uploadedFiles = newFiles?.length
    ? await uploadWebhookFiles({ supabase, userId, webhookId, files: newFiles })
    : []

  const nextFiles = [...retainedFiles, ...uploadedFiles]

  const snapshotWithFiles: BuilderStateSnapshot = {
    ...snapshot,
    files: nextFiles,
  }

  const messagePayload = createWebhookMessagePayload(snapshotWithFiles)

  const { data, error } = await supabase
    .from(SAVED_WEBHOOKS_TABLE)
    .update({
      name,
      message_data: messagePayload,
      builder_state: snapshotWithFiles,
      files: nextFiles,
      updated_at: new Date().toISOString(),
    })
    .eq('id', webhookId)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    if (uploadedFiles.length > 0) {
      void removeWebhookFiles(supabase, uploadedFiles)
    }
    throw error
  }

  if (filesToRemove.length > 0) {
    void removeWebhookFiles(supabase, filesToRemove)
  }

  return data as SavedWebhookRow
}

export type DeleteSavedWebhookParams = {
  supabase: SupabaseClient
  webhookId: string
  userId: string
}

export const deleteSavedWebhook = async ({ supabase, webhookId, userId }: DeleteSavedWebhookParams) => {
  const { data, error } = await supabase
    .from(SAVED_WEBHOOKS_TABLE)
    .delete()
    .eq('id', webhookId)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    throw error
  }

  const deletedRow = data as SavedWebhookRow | null
  if (deletedRow?.files?.length) {
    void removeWebhookFiles(supabase, deletedRow.files)
  }

  return deletedRow
}

export const fetchSavedWebhooks = async (supabase: SupabaseClient, userId: string) => {
  const { data, error } = await supabase
    .from(SAVED_WEBHOOKS_TABLE)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  return (data ?? []) as SavedWebhookRow[]
}

export const getSavedWebhookById = async (supabase: SupabaseClient, userId: string, webhookId: string) => {
  const { data, error } = await supabase
    .from(SAVED_WEBHOOKS_TABLE)
    .select('*')
    .eq('user_id', userId)
    .eq('id', webhookId)
    .single()

  if (error) {
    throw error
  }

  return data as SavedWebhookRow
}

export const createSignedWebhookFileUrl = async (supabase: SupabaseClient, file: StoredFileAttachment, expiresInSeconds = 60) => {
  const { data, error } = await supabase.storage
    .from(WEBHOOK_FILES_BUCKET)
    .createSignedUrl(file.storagePath, expiresInSeconds)

  if (error) {
    throw error
  }

  return data?.signedUrl ?? null
}