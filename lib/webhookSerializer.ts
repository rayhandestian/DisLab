import {
  EmbedData,
  embedHasRenderableContent,
  transformEmbedForPayload,
} from '@/hooks/useWebhookBuilder'

export type StoredFileAttachment = {
  name: string
  size: number
  mimeType: string
  storagePath: string
  originalIndex?: number
}

export type BuilderStateSnapshot = {
  content: string
  username: string
  avatarUrl: string
  threadName: string
  suppressEmbeds: boolean
  suppressNotifications: boolean
  embeds: EmbedData[]
  files?: StoredFileAttachment[]
  webhookUrl?: string
}

export type WebhookMessagePayload = {
  content?: string
  username?: string
  avatar_url?: string
  thread_name?: string
  flags?: number
  embeds?: unknown[]
}

export const calculateMessageFlags = (suppressEmbeds: boolean, suppressNotifications: boolean) => {
  let flags = 0
  if (suppressEmbeds) flags |= 1 << 2
  if (suppressNotifications) flags |= 1 << 12
  return flags
}

export const createWebhookMessagePayload = (snapshot: BuilderStateSnapshot): WebhookMessagePayload => {
  const payload: WebhookMessagePayload = {}
  const trimmedContent = snapshot.content.trim()
  if (trimmedContent) payload.content = trimmedContent

  const trimmedUsername = snapshot.username.trim()
  if (trimmedUsername) payload.username = trimmedUsername

  const trimmedAvatar = snapshot.avatarUrl.trim()
  if (trimmedAvatar) payload.avatar_url = trimmedAvatar

  const trimmedThread = snapshot.threadName.trim()
  if (trimmedThread) payload.thread_name = trimmedThread

  const flags = calculateMessageFlags(snapshot.suppressEmbeds, snapshot.suppressNotifications)
  if (flags > 0) payload.flags = flags

  const embedsPayload = snapshot.embeds
    .filter(embedHasRenderableContent)
    .map(transformEmbedForPayload)
    .filter(embed => Object.keys(embed).length > 0)

  if (embedsPayload.length > 0) payload.embeds = embedsPayload

  return payload
}

export type ScheduleInsertPayload = {
  user_id: string
  name: string
  webhook_url: string
  schedule_time: string
  message_data: WebhookMessagePayload
  builder_state: BuilderStateSnapshot
  files?: StoredFileAttachment[]
}

export type CreateScheduleParams = {
  userId: string
  name: string
  webhookUrl: string
  scheduleTime: Date | string
  snapshot: BuilderStateSnapshot
  files?: StoredFileAttachment[]
}

export const createScheduleInsertPayload = ({
  userId,
  name,
  webhookUrl,
  scheduleTime,
  snapshot,
  files,
}: CreateScheduleParams): ScheduleInsertPayload => {
  const isoTime = typeof scheduleTime === 'string' ? new Date(scheduleTime).toISOString() : scheduleTime.toISOString()
  const messagePayload = createWebhookMessagePayload(snapshot)

  return {
    user_id: userId,
    name,
    webhook_url: webhookUrl,
    schedule_time: isoTime,
    message_data: messagePayload,
    builder_state: snapshot,
    files: files ?? snapshot.files,
  }
}

export type HydratedBuilderState = {
  content: string
  username: string
  avatarUrl: string
  threadName: string
  suppressEmbeds: boolean
  suppressNotifications: boolean
  embeds: EmbedData[]
  files?: StoredFileAttachment[]
  webhookUrl?: string
}

export const hydrateBuilderState = (snapshot: Partial<BuilderStateSnapshot>): HydratedBuilderState => {
  return {
    content: snapshot.content ?? '',
    username: snapshot.username ?? '',
    avatarUrl: snapshot.avatarUrl ?? '',
    threadName: snapshot.threadName ?? '',
    suppressEmbeds: snapshot.suppressEmbeds ?? false,
    suppressNotifications: snapshot.suppressNotifications ?? false,
    embeds: snapshot.embeds ?? [],
    files: snapshot.files ?? [],
    webhookUrl: snapshot.webhookUrl,
  }
}