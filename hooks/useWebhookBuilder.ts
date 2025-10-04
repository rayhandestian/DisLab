'use client'

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { marked } from 'marked'

marked.use({ breaks: true })

export const DEFAULT_AVATAR = 'https://cdn.discordapp.com/embed/avatars/0.png'
export const DEFAULT_COLOR = '#5865F2'
export const MAX_FILES_BYTES = 25 * 1024 * 1024
export const MAX_EMBEDS = 10

export type SectionKey = 'profile' | 'content' | 'optional' | 'embeds' | 'advanced'

export type EmbedField = {
  id: string
  name: string
  value: string
  inline: boolean
}

export type EmbedData = {
  id: string
  authorName: string
  authorUrl: string
  authorIconUrl: string
  title: string
  url: string
  description: string
  color: string
  imageUrl: string
  thumbnailUrl: string
  footerText: string
  footerIconUrl: string
  timestampValue?: string
  fields: EmbedField[]
}

export type BuilderStatusVariant = 'success' | 'error'

export const createId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

export const createDefaultEmbed = (): EmbedData => ({
  id: createId(),
  authorName: '',
  authorUrl: '',
  authorIconUrl: '',
  title: '',
  url: '',
  description: '',
  color: DEFAULT_COLOR,
  imageUrl: '',
  thumbnailUrl: '',
  footerText: '',
  footerIconUrl: '',
  timestampValue: undefined,
  fields: [],
})

export const isValidHexColor = (value: string) => /^#[0-9A-Fa-f]{6}$/.test(value)

export const toLocalISOString = (date: Date) => {
  const tzOffset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16)
}

export const formatTimestampText = (value?: string) => {
  if (!value) return ''
  try {
    return new Date(value).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }).replace(',', ' at')
  } catch {
    return ''
  }
}

export const embedHasRenderableContent = (embed: EmbedData) => {
  const hasFields = embed.fields.some(field => field.name.trim() || field.value.trim())
  return Boolean(
    embed.authorName.trim() ||
      embed.title.trim() ||
      embed.description.trim() ||
      embed.footerText.trim() ||
      embed.imageUrl.trim() ||
      embed.thumbnailUrl.trim() ||
      hasFields ||
      embed.timestampValue
  )
}

export const transformEmbedForPayload = (embed: EmbedData) => {
  const payload: Record<string, unknown> = {}
  if (embed.authorName.trim()) {
    payload.author = {
      name: embed.authorName.trim(),
      url: embed.authorUrl.trim() || undefined,
      icon_url: embed.authorIconUrl.trim() || undefined,
    }
  }
  if (embed.title.trim()) payload.title = embed.title.trim()
  if (embed.url.trim()) payload.url = embed.url.trim()
  if (embed.description.trim()) payload.description = embed.description.trim()
  if (isValidHexColor(embed.color)) payload.color = parseInt(embed.color.substring(1), 16)
  if (embed.imageUrl.trim()) payload.image = { url: embed.imageUrl.trim() }
  if (embed.thumbnailUrl.trim()) payload.thumbnail = { url: embed.thumbnailUrl.trim() }
  if (embed.footerText.trim()) {
    payload.footer = {
      text: embed.footerText.trim(),
      icon_url: embed.footerIconUrl.trim() || undefined,
    }
  }
  if (embed.timestampValue) {
    try {
      payload.timestamp = new Date(embed.timestampValue).toISOString()
    } catch {
      /* swallow invalid timestamp */
    }
  }
  const validFields = embed.fields
    .filter(field => field.name.trim() && field.value.trim())
    .map(field => ({
      name: field.name.trim(),
      value: field.value.trim(),
      inline: field.inline,
    }))
  if (validFields.length > 0) payload.fields = validFields
  return payload
}

type UseWebhookBuilderOptions = {
  onStatus?: (message: string, variant: BuilderStatusVariant) => void
}

export function useWebhookBuilder(options: UseWebhookBuilderOptions = {}) {
  const { onStatus } = options
  const [webhookUrl, setWebhookUrl] = useState('')
  const [username, setUsername] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [message, setMessage] = useState('')
  const [threadName, setThreadName] = useState('')
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [statusVariant, setStatusVariant] = useState<BuilderStatusVariant>('success')
  const [isSending, setIsSending] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [embedsData, setEmbedsData] = useState<EmbedData[]>([createDefaultEmbed()])
  const [activeEmbedIndex, setActiveEmbedIndex] = useState(0)
  const [suppressEmbeds, setSuppressEmbeds] = useState(false)
  const [suppressNotifications, setSuppressNotifications] = useState(false)
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    profile: true,
    content: true,
    optional: false,
    embeds: true,
    advanced: false,
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const saved = localStorage.getItem('discordWebhookUrl')
      if (saved) setWebhookUrl(saved)
    } catch {
      /* ignore storage errors */
    }
  }, [])

  useEffect(() => {
    if (!statusMessage) return
    const timer = window.setTimeout(() => setStatusMessage(null), 5000)
    return () => window.clearTimeout(timer)
  }, [statusMessage])

  const activeEmbed = embedsData[activeEmbedIndex] ?? embedsData[0]

  const toggleSection = (section: SectionKey) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  const showStatus = (messageText: string, variant: BuilderStatusVariant = 'success') => {
    setStatusVariant(variant)
    setStatusMessage(messageText)
    onStatus?.(messageText, variant)
  }

  const totalFileSize = useMemo(() => files.reduce((acc, file) => acc + file.size, 0), [files])
  const isFileSizeExceeded = totalFileSize > MAX_FILES_BYTES

  const previewMessageHTML = useMemo(() => {
    const trimmed = message.trim()
    if (!trimmed) return ''
    return marked.parse(trimmed)
  }, [message])

  const previewTimestampText = useMemo(
    () => new Date().toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }).replace(',', ' at'),
    [message, username, avatarUrl, embedsData, files, threadName]
  )

  const updateActiveEmbed = (updater: (embed: EmbedData) => EmbedData) => {
    setEmbedsData(prev =>
      prev.map((embed, index) => {
        if (index !== activeEmbedIndex) return embed
        return updater(embed)
      })
    )
  }

  const handleEmbedInputChange = <K extends keyof EmbedData>(key: K, value: EmbedData[K]) => {
    updateActiveEmbed(embed => ({
      ...embed,
      [key]: value,
    }))
  }

  const handleAddField = () => {
    if (!activeEmbed) return
    updateActiveEmbed(embed => ({
      ...embed,
      fields: [
        ...embed.fields,
        {
          id: createId(),
          name: '',
          value: '',
          inline: false,
        },
      ],
    }))
  }

  const handleRemoveField = (fieldId: string) => {
    updateActiveEmbed(embed => ({
      ...embed,
      fields: embed.fields.filter(field => field.id !== fieldId),
    }))
  }

  const handleFieldChange = (fieldId: string, updates: Partial<EmbedField>) => {
    updateActiveEmbed(embed => ({
      ...embed,
      fields: embed.fields.map(field => (field.id === fieldId ? { ...field, ...updates } : field)),
    }))
  }

  const handleTimestampToggle = (checked: boolean) => {
    updateActiveEmbed(embed => ({
      ...embed,
      timestampValue: checked ? embed.timestampValue ?? toLocalISOString(new Date()) : undefined,
    }))
  }

  const handleTimestampChange = (value: string) => {
    updateActiveEmbed(embed => ({
      ...embed,
      timestampValue: value,
    }))
  }

  const handleAddEmbed = () => {
    if (embedsData.length >= MAX_EMBEDS) {
      showStatus('You can have a maximum of 10 embeds.', 'error')
      return
    }
    const newEmbed = createDefaultEmbed()
    setEmbedsData(prev => [...prev, newEmbed])
    setActiveEmbedIndex(embedsData.length)
  }

  const handleRemoveEmbed = (index: number) => {
    if (embedsData.length <= 1) return
    setEmbedsData(prev => {
      const next = prev.filter((_, idx) => idx !== index)
      const nextList = next.length > 0 ? next : [createDefaultEmbed()]
      const nextActive =
        activeEmbedIndex === index ? Math.max(0, index - 1) : activeEmbedIndex > index ? activeEmbedIndex - 1 : activeEmbedIndex
      setActiveEmbedIndex(Math.min(nextActive, nextList.length - 1))
      return nextList
    })
  }

  const handleFileUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? [])
    setFiles(selectedFiles)
    const total = selectedFiles.reduce((acc, file) => acc + file.size, 0)
    if (total > MAX_FILES_BYTES) {
      showStatus('Total file size exceeds 25 MB!', 'error')
    }
  }

  const clearWebhook = () => {
    setWebhookUrl('')
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('discordWebhookUrl')
      } catch {
        /* ignore */
      }
    }
  }

  const getValidWebhookUrl = () => {
    const trimmed = webhookUrl.trim()
    if (trimmed.startsWith('https://discord.com/api/webhooks/')) {
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('discordWebhookUrl', trimmed)
        } catch {
          /* ignore */
        }
      }
      return trimmed
    }
    showStatus('Please enter a valid Discord webhook URL.', 'error')
    return null
  }

  const postToDiscord = async (url: string, body: FormData | Record<string, unknown>) => {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: body instanceof FormData ? undefined : { 'Content-Type': 'application/json' },
        body: body instanceof FormData ? body : JSON.stringify(body),
      })

      if (response.ok) {
        showStatus('Message sent successfully!', 'success')
        return true
      }

      const errorData = await response.json().catch(() => undefined)
      const messageText =
        errorData?.message && errorData?.errors
          ? `${errorData.message}: ${JSON.stringify(errorData.errors)}`
          : errorData?.message ?? 'Something went wrong.'
      showStatus(`Error: ${messageText} (Code: ${response.status})`, 'error')
      console.error('Discord API Error:', errorData)
      return false
    } catch (error) {
      console.error('Fetch Error:', error)
      showStatus('Failed to send message. Check the console and your network connection.', 'error')
      return false
    }
  }

  const sendWebhook = async (isTest: boolean) => {
    if (isSending) return
    const validUrl = getValidWebhookUrl()
    if (!validUrl) return

    if (!isTest) {
      const hasContent = message.trim().length > 0 || files.length > 0 || embedsData.some(embed => embedHasRenderableContent(embed))
      if (!hasContent) {
        showStatus('Cannot send an empty message.', 'error')
        return
      }
      if (isFileSizeExceeded) {
        showStatus('Total file size exceeds 25 MB!', 'error')
        return
      }
    }

    setIsSending(true)
    try {
      if (isTest) {
        const payload = {
          content: 'This is a test message from the Webhook Sender.',
          username: 'Webhook Tester',
          avatar_url: 'https://i.imgur.com/fKL31aD.png',
        }
        await postToDiscord(validUrl, payload)
        return
      }

      const payload: Record<string, unknown> = {}
      if (username.trim()) payload.username = username.trim()
      if (avatarUrl.trim()) payload.avatar_url = avatarUrl.trim()
      if (message.trim()) payload.content = message.trim()
      if (threadName.trim()) payload.thread_name = threadName.trim()

      let flags = 0
      if (suppressEmbeds) flags |= 1 << 2
      if (suppressNotifications) flags |= 1 << 12
      if (flags > 0) payload.flags = flags

      const embedsPayload = embedsData
        .filter(embedHasRenderableContent)
        .map(transformEmbedForPayload)
        .filter(embed => Object.keys(embed).length > 0)

      if (embedsPayload.length > 0) payload.embeds = embedsPayload

      if (!payload.content && (!payload.embeds || (payload.embeds as unknown[]).length === 0) && files.length === 0) {
        showStatus('Cannot send an empty message.', 'error')
        return
      }

      if (files.length > 0) {
        if (isFileSizeExceeded) {
          showStatus('Total file size exceeds 25 MB!', 'error')
          return
        }
        const formData = new FormData()
        formData.append('payload_json', JSON.stringify(payload))
        files.forEach((file, index) => {
          formData.append(`files[${index}]`, file)
        })
        await postToDiscord(`${validUrl}?wait=true`, formData)
      } else {
        await postToDiscord(`${validUrl}?wait=true`, payload)
      }
    } finally {
      setIsSending(false)
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await sendWebhook(false)
  }

  const builderState = {
    webhookUrl,
    setWebhookUrl,
    username,
    setUsername,
    avatarUrl,
    setAvatarUrl,
    message,
    setMessage,
    threadName,
    setThreadName,
    statusMessage,
    statusVariant,
    isSending,
    files,
    setFiles,
    embedsData,
    setEmbedsData,
    activeEmbedIndex,
    setActiveEmbedIndex,
    activeEmbed,
    suppressEmbeds,
    setSuppressEmbeds,
    suppressNotifications,
    setSuppressNotifications,
    openSections,
    setOpenSections,
  }

  return {
    ...builderState,
    toggleSection,
    totalFileSize,
    isFileSizeExceeded,
    previewMessageHTML,
    previewTimestampText,
    handleEmbedInputChange,
    handleAddField,
    handleRemoveField,
    handleFieldChange,
    handleTimestampToggle,
    handleTimestampChange,
    handleAddEmbed,
    handleRemoveEmbed,
    handleFileUpload,
    clearWebhook,
    showStatus,
    sendWebhook,
    handleSubmit,
    postToDiscord,
    getValidWebhookUrl,
  }
}

export type WebhookBuilderApi = ReturnType<typeof useWebhookBuilder>