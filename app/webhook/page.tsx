'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { marked } from 'marked'

marked.use({ breaks: true })

const DEFAULT_AVATAR = 'https://cdn.discordapp.com/embed/avatars/0.png'
const DEFAULT_COLOR = '#5865F2'
const MAX_FILES_BYTES = 25 * 1024 * 1024
const MAX_EMBEDS = 10

type SectionKey = 'profile' | 'content' | 'optional' | 'embeds' | 'advanced'

type EmbedField = {
  id: string
  name: string
  value: string
  inline: boolean
}

type EmbedData = {
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

const createId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

const createDefaultEmbed = (): EmbedData => ({
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

const isValidHexColor = (value: string) => /^#[0-9A-Fa-f]{6}$/.test(value)

const toLocalISOString = (date: Date) => {
  const tzOffset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16)
}

const formatTimestampText = (value?: string) => {
  if (!value) return ''
  try {
    return new Date(value).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }).replace(',', ' at')
  } catch {
    return ''
  }
}

const embedHasRenderableContent = (embed: EmbedData) => {
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

const transformEmbedForPayload = (embed: EmbedData) => {
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

export default function WebhookPage() {
  const [webhookUrl, setWebhookUrl] = useState('')
  const [username, setUsername] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [message, setMessage] = useState('')
  const [threadName, setThreadName] = useState('')
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [statusVariant, setStatusVariant] = useState<'success' | 'error'>('success')
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

  const activeEmbed = embedsData[activeEmbedIndex] ?? embedsData[0]

  const toggleSection = (section: SectionKey) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

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

  const showStatus = (messageText: string, variant: 'success' | 'error' = 'success') => {
    setStatusVariant(variant)
    setStatusMessage(messageText)
  }

  const totalFileSize = useMemo(() => files.reduce((acc, file) => acc + file.size, 0), [files])
  const isFileSizeExceeded = totalFileSize > MAX_FILES_BYTES

  const previewMessageHTML = useMemo(() => {
    const trimmed = message.trim()
    if (!trimmed) return ''
    return marked.parse(trimmed)
  }, [message])

  const previewEmbeds = useMemo<React.ReactNode[]>(() => {
    return embedsData
      .map(embed => {
        if (!embedHasRenderableContent(embed)) return null

        const colorBar = isValidHexColor(embed.color) ? embed.color : DEFAULT_COLOR
        const fieldElements: React.ReactNode[] = []
        let inlineBuffer: React.ReactNode[] = []

        const flushInline = () => {
          if (inlineBuffer.length === 0) return
          fieldElements.push(
            <div
              key={`inline-group-${embed.id}-${fieldElements.length}`}
              className="grid gap-4 md:grid"
              style={{ gridTemplateColumns: `repeat(${inlineBuffer.length}, minmax(0, 1fr))` }}
            >
              {inlineBuffer}
            </div>
          )
          inlineBuffer = []
        }

        embed.fields.forEach(field => {
          if (!field.name.trim() && !field.value.trim()) return
          const nameHTML = marked.parseInline(field.name.trim())
          const valueHTML = marked.parse(field.value.trim())
          const fieldBlock = (
            <div key={field.id} className="min-w-0">
              <div className="font-bold text-sm text-white break-words" dangerouslySetInnerHTML={{ __html: nameHTML }} />
              <div
                className="text-sm text-gray-300 whitespace-pre-wrap break-words prose max-w-none"
                dangerouslySetInnerHTML={{ __html: valueHTML }}
              />
            </div>
          )

          if (field.inline) {
            inlineBuffer.push(fieldBlock)
            if (inlineBuffer.length === 3) flushInline()
          } else {
            flushInline()
            fieldElements.push(fieldBlock)
          }
        })
        flushInline()

        const authorContent =
          embed.authorName.trim() && (
            <div className="flex items-center">
              {embed.authorIconUrl.trim() && (
                <img src={embed.authorIconUrl.trim()} alt="Author Icon" className="w-6 h-6 rounded-full mr-2" />
              )}
              {embed.authorUrl.trim() ? (
                <a
                  href={embed.authorUrl.trim()}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-semibold text-white break-words hover:underline"
                >
                  {embed.authorName.trim()}
                </a>
              ) : (
                <span className="text-sm font-semibold text-white break-words">{embed.authorName.trim()}</span>
              )}
            </div>
          )

        const footerTimestamp = formatTimestampText(embed.timestampValue)

        return (
          <div key={embed.id} className="flex">
            <div className="w-1 rounded-l-md" style={{ backgroundColor: colorBar }} />
            <div className="bg-[#2F3136] rounded-r-md p-4 relative grid gap-2 flex-1 min-w-0">
              {authorContent}
              {embed.title.trim() && (
                <div className="font-bold text-white break-words">
                  {embed.url.trim() ? (
                    <a
                      href={embed.url.trim()}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-400 hover:underline break-words"
                    >
                      {embed.title.trim()}
                    </a>
                  ) : (
                    embed.title.trim()
                  )}
                </div>
              )}
              {embed.description.trim() && (
                <div
                  className="text-sm text-gray-300 whitespace-pre-wrap break-words prose max-w-none"
                  dangerouslySetInnerHTML={{ __html: marked.parse(embed.description.trim()) }}
                />
              )}
              {fieldElements.length > 0 && <div className="grid gap-y-2 mt-2">{fieldElements}</div>}
              {embed.imageUrl.trim() && (
                <img src={embed.imageUrl.trim()} alt="Embed Image" className="rounded-md mt-2 max-w-full h-auto" />
              )}
              {embed.thumbnailUrl.trim() && (
                <img
                  src={embed.thumbnailUrl.trim()}
                  alt="Embed Thumbnail"
                  className="absolute top-4 right-4 w-16 h-16 rounded-md object-cover"
                />
              )}
              {embed.footerText.trim() ? (
                <div className="flex items-center text-xs text-gray-400 mt-2">
                  {embed.footerIconUrl.trim() && (
                    <img src={embed.footerIconUrl.trim()} alt="Footer Icon" className="w-4 h-4 rounded-full mr-1.5" />
                  )}
                  <span className="break-words">
                    {embed.footerText.trim()}
                    {footerTimestamp ? ` • ${footerTimestamp}` : ''}
                  </span>
                </div>
              ) : (
                footerTimestamp && <div className="text-xs text-gray-400 mt-2">{footerTimestamp}</div>
              )}
            </div>
          </div>
        )
      })
      .filter(Boolean) as React.ReactNode[]
  }, [embedsData])

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
        activeEmbedIndex === index
          ? Math.max(0, index - 1)
          : activeEmbedIndex > index
            ? activeEmbedIndex - 1
            : activeEmbedIndex
      setActiveEmbedIndex(Math.min(nextActive, nextList.length - 1))
      return nextList
    })
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
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
      const hasContent =
        message.trim().length > 0 || files.length > 0 || embedsData.some(embed => embedHasRenderableContent(embed))
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

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await sendWebhook(false)
  }

  const timestampEnabled = Boolean(activeEmbed?.timestampValue)
  const previewUsername = username.trim() || 'Bot'
  const previewAvatar = avatarUrl.trim() || DEFAULT_AVATAR
  const previewTimestampText = useMemo(
    () => new Date().toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }).replace(',', ' at'),
    [message, username, avatarUrl, embedsData, files, threadName]
  )
  const colorPickerValue = isValidHexColor(activeEmbed?.color ?? '') ? activeEmbed!.color : DEFAULT_COLOR

  return (
    <div className="min-h-screen bg-gray-900 text-white py-8 px-4 sm:px-6 lg:px-8">
      <div className="w-full flex flex-col lg:flex-row gap-8">
        <div className="lg:w-3/5 w-full">
          <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-lg p-6 sm:p-8 fade-in">
            <div className="text-center mb-8">
              <h1 className="text-3xl sm:text-4xl font-bold text-indigo-400">Discord Webhook Sender</h1>
              <p className="text-gray-400 mt-2">A comprehensive tool to build and send messages via webhooks.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="border-b border-gray-700 pb-4">
                <label className="form-label">Webhook URL</label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="password"
                    value={webhookUrl}
                    onChange={event => setWebhookUrl(event.target.value)}
                    placeholder="Enter your Discord webhook URL"
                    className="flex-grow bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 block w-full p-3 transition duration-150"
                  />
                  <button
                    type="button"
                    onClick={clearWebhook}
                    className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-4 rounded-lg transition duration-150 shadow-md"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="border-b border-gray-700 py-2">
                <button
                  type="button"
                  className={`w-full flex justify-between items-center text-left section-toggle ${openSections.profile ? 'open' : ''}`}
                  onClick={() => toggleSection('profile')}
                >
                  <h2 className="section-title">Profile</h2>
                  <svg className="w-5 h-5 text-gray-400 chevron" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
                <div className={`section-content mt-4 ${openSections.profile ? 'open' : ''}`}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="form-label">Username (Optional)</label>
                      <input
                        type="text"
                        value={username}
                        onChange={event => setUsername(event.target.value)}
                        placeholder="Custom Bot Name"
                        maxLength={80}
                        className="bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 block w-full p-3 transition duration-150"
                      />
                      <p className="form-hint">Max 80 characters.</p>
                    </div>
                    <div>
                      <label className="form-label">Avatar URL (Optional)</label>
                      <input
                        type="url"
                        value={avatarUrl}
                        onChange={event => setAvatarUrl(event.target.value)}
                        placeholder="https://i.imgur.com/..."
                        className="bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 block w-full p-3 transition duration-150"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-b border-gray-700 py-2">
                <button
                  type="button"
                  className={`w-full flex justify-between items-center text-left section-toggle ${openSections.content ? 'open' : ''}`}
                  onClick={() => toggleSection('content')}
                >
                  <h2 className="section-title">Content</h2>
                  <svg className="w-5 h-5 text-gray-400 chevron" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
                <div className={`section-content mt-4 ${openSections.content ? 'open' : ''}`}>
                  <label className="form-label">Message</label>
                  <textarea
                    value={message}
                    onChange={event => setMessage(event.target.value)}
                    rows={4}
                    placeholder="Type your message here..."
                    maxLength={2000}
                    className="bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 block w-full p-3 transition duration-150"
                  />
                  <p className="form-hint">Max 2000 characters. Supports Markdown.</p>
                </div>
              </div>

              <div className="border-b border-gray-700 py-2">
                <button
                  type="button"
                  className={`w-full flex justify-between items-center text-left section-toggle ${openSections.optional ? 'open' : ''}`}
                  onClick={() => toggleSection('optional')}
                >
                  <h2 className="section-title">Optional Settings</h2>
                  <svg className="w-5 h-5 text-gray-400 chevron" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
                <div className={`section-content mt-4 ${openSections.optional ? 'open' : ''}`}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="form-label">Forum Thread Name</label>
                      <input
                        type="text"
                        value={threadName}
                        onChange={event => setThreadName(event.target.value)}
                        placeholder="New Thread Title"
                        maxLength={100}
                        className="bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 block w-full p-3 transition duration-150"
                      />
                      <p className="form-hint">Max 100 characters.</p>
                    </div>
                    <div>
                      <label className="form-label">Attach Files</label>
                      <input
                        type="file"
                        multiple
                        onChange={handleFileUpload}
                        className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 cursor-pointer"
                      />
                      <div className={`form-hint ${isFileSizeExceeded ? 'text-red-400' : ''}`}>
                        {files.length > 0
                          ? `${files.length} file(s) selected. Total size: ${(totalFileSize / 1024 / 1024).toFixed(2)} MB.`
                          : 'Max total size: 25 MB.'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-b border-gray-700 py-2">
                <button
                  type="button"
                  className={`w-full flex justify-between items-center text-left section-toggle ${openSections.embeds ? 'open' : ''}`}
                  onClick={() => toggleSection('embeds')}
                >
                  <h2 className="section-title">Embeds</h2>
                  <svg className="w-5 h-5 text-gray-400 chevron" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
                <div className={`section-content mt-4 ${openSections.embeds ? 'open' : ''}`}>
                  <div className="flex items-center gap-2 mb-3 border-b border-gray-700 pb-2">
                    <div id="embed-tabs-nav" className="flex-grow flex items-center gap-1 overflow-x-auto pb-1">
                      {embedsData.map((embed, index) => (
                        <button
                          key={embed.id}
                          type="button"
                          onClick={() => setActiveEmbedIndex(index)}
                          className={`text-sm font-semibold py-1 px-3 rounded-md transition duration-150 whitespace-nowrap ${
                            index === activeEmbedIndex ? 'bg-indigo-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                          }`}
                        >
                          Embed {index + 1}
                          {embedsData.length > 1 && (
                            <span
                              role="button"
                              tabIndex={-1}
                              onClick={event => {
                                event.stopPropagation()
                                handleRemoveEmbed(index)
                              }}
                              className="ml-1 text-indigo-200 hover:text-white"
                            >
                              ✕
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={handleAddEmbed}
                      className="text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-1 px-3 rounded-md transition duration-150 shadow-md whitespace-nowrap"
                    >
                      + Add Embed
                    </button>
                  </div>

                  {activeEmbed && (
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-300">Author</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                          <div>
                            <label className="form-label">Author Name</label>
                            <input
                              type="text"
                              value={activeEmbed.authorName}
                              onChange={event => handleEmbedInputChange('authorName', event.target.value)}
                              placeholder="e.g., Jane Doe"
                              maxLength={256}
                              className="w-full bg-gray-700 p-2.5 rounded-lg border border-gray-600 focus:ring-indigo-500"
                            />
                            <p className="form-hint">Max 256 chars.</p>
                          </div>
                          <div>
                            <label className="form-label">Author URL</label>
                            <input
                              type="url"
                              value={activeEmbed.authorUrl}
                              onChange={event => handleEmbedInputChange('authorUrl', event.target.value)}
                              placeholder="https://..."
                              className="w-full bg-gray-700 p-2.5 rounded-lg border border-gray-600 focus:ring-indigo-500"
                            />
                          </div>
                          <div>
                            <label className="form-label">Author Icon URL</label>
                            <input
                              type="url"
                              value={activeEmbed.authorIconUrl}
                              onChange={event => handleEmbedInputChange('authorIconUrl', event.target.value)}
                              placeholder="https://..."
                              className="w-full bg-gray-700 p-2.5 rounded-lg border border-gray-600 focus:ring-indigo-500"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="pt-2">
                        <h3 className="text-lg font-semibold text-gray-300">Body</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                          <div>
                            <label className="form-label">Title</label>
                            <input
                              type="text"
                              value={activeEmbed.title}
                              onChange={event => handleEmbedInputChange('title', event.target.value)}
                              placeholder="e.g., Weekly Report"
                              maxLength={256}
                              className="bg-gray-700 p-2.5 rounded-lg border border-gray-600 focus:ring-indigo-500 w-full"
                            />
                            <p className="form-hint">Max 256 chars.</p>
                          </div>
                          <div>
                            <label className="form-label">Title URL</label>
                            <input
                              type="url"
                              value={activeEmbed.url}
                              onChange={event => handleEmbedInputChange('url', event.target.value)}
                              placeholder="https://..."
                              className="bg-gray-700 p-2.5 rounded-lg border border-gray-600 focus:ring-indigo-500 w-full"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label className="form-label">Description</label>
                            <textarea
                              value={activeEmbed.description}
                              onChange={event => handleEmbedInputChange('description', event.target.value)}
                              rows={5}
                              placeholder="Supports Markdown..."
                              maxLength={4096}
                              className="w-full bg-gray-700 p-2.5 rounded-lg border border-gray-600 focus:ring-indigo-500"
                            />
                            <p className="form-hint">Max 4096 chars.</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="form-label mb-0">Color</label>
                            <input
                              type="color"
                              value={colorPickerValue}
                              onChange={event => handleEmbedInputChange('color', event.target.value)}
                              className="p-1 h-10 w-10 block bg-gray-700 border border-gray-600 cursor-pointer rounded-lg"
                            />
                            <input
                              type="text"
                              value={activeEmbed.color}
                              onChange={event => handleEmbedInputChange('color', event.target.value)}
                              placeholder="#5865F2"
                              className="w-full bg-gray-700 p-2.5 rounded-lg border border-gray-600 focus:ring-indigo-500"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="pt-2">
                        <h3 className="text-lg font-semibold text-gray-300">Images</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                          <div>
                            <label className="form-label">Image URL</label>
                            <input
                              type="url"
                              value={activeEmbed.imageUrl}
                              onChange={event => handleEmbedInputChange('imageUrl', event.target.value)}
                              placeholder="https://..."
                              className="w-full bg-gray-700 p-2.5 rounded-lg border border-gray-600 focus:ring-indigo-500"
                            />
                          </div>
                          <div>
                            <label className="form-label">Thumbnail URL</label>
                            <input
                              type="url"
                              value={activeEmbed.thumbnailUrl}
                              onChange={event => handleEmbedInputChange('thumbnailUrl', event.target.value)}
                              placeholder="https://..."
                              className="w-full bg-gray-700 p-2.5 rounded-lg border border-gray-600 focus:ring-indigo-500"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="pt-2">
                        <h3 className="text-lg font-semibold text-gray-300">Footer</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                          <div>
                            <label className="form-label">Footer Text</label>
                            <input
                              type="text"
                              value={activeEmbed.footerText}
                              onChange={event => handleEmbedInputChange('footerText', event.target.value)}
                              placeholder="e.g., Status: OK"
                              maxLength={2048}
                              className="w-full bg-gray-700 p-2.5 rounded-lg border border-gray-600 focus:ring-indigo-500"
                            />
                            <p className="form-hint">Max 2048 chars.</p>
                          </div>
                          <div>
                            <label className="form-label">Footer Icon URL</label>
                            <input
                              type="url"
                              value={activeEmbed.footerIconUrl}
                              onChange={event => handleEmbedInputChange('footerIconUrl', event.target.value)}
                              placeholder="https://..."
                              className="w-full bg-gray-700 p-2.5 rounded-lg border border-gray-600 focus:ring-indigo-500"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <div className="flex items-center mb-2">
                              <input
                                type="checkbox"
                                checked={timestampEnabled}
                                onChange={event => handleTimestampToggle(event.target.checked)}
                                className="h-4 w-4 rounded bg-gray-600 border-gray-500 text-indigo-600 focus:ring-indigo-500"
                              />
                              <label className="ml-2 text-sm text-gray-300">Enable Custom Timestamp</label>
                            </div>
                            <div className={timestampEnabled ? '' : 'hidden'}>
                              <label className="form-label">Timestamp</label>
                              <input
                                type="datetime-local"
                                value={activeEmbed.timestampValue ?? ''}
                                onChange={event => handleTimestampChange(event.target.value)}
                                className="w-full bg-gray-700 p-2.5 rounded-lg border border-gray-600 focus:ring-indigo-500 text-gray-300"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="pt-2">
                        <h3 className="text-lg font-semibold text-gray-300">Fields</h3>
                        <div id="embed-fields-container" className="space-y-3 mt-2">
                          {activeEmbed.fields.map(field => (
                            <div key={field.id} className="p-3 bg-gray-900/50 rounded-lg border border-gray-700 fade-in">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2">
                                <div>
                                  <label className="text-xs font-medium text-gray-400">Field Name</label>
                                  <input
                                    type="text"
                                    value={field.name}
                                    onChange={event => handleFieldChange(field.id, { name: event.target.value })}
                                    placeholder="Max 256 chars"
                                    maxLength={256}
                                    className="field-name w-full mt-1 bg-gray-700 border border-gray-600 text-white rounded-md p-2 text-sm focus:ring-1 focus:ring-indigo-500"
                                  />
                                </div>
                                <div className="flex items-end pb-1">
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      checked={field.inline}
                                      onChange={event => handleFieldChange(field.id, { inline: event.target.checked })}
                                      className="field-inline h-4 w-4 rounded bg-gray-600 border-gray-500 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <label className="text-sm text-gray-300">Inline</label>
                                  </div>
                                </div>
                              </div>
                              <div className="mt-2">
                                <label className="text-xs font-medium text-gray-400">Field Value</label>
                                <textarea
                                  value={field.value}
                                  onChange={event => handleFieldChange(field.id, { value: event.target.value })}
                                  placeholder="Max 1024 chars"
                                  maxLength={1024}
                                  className="field-value w-full mt-1 bg-gray-700 border border-gray-600 text-white rounded-md p-2 text-sm"
                                  rows={2}
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveField(field.id)}
                                className="remove-field-btn mt-2 text-xs bg-red-600/80 hover:bg-red-600 text-white font-semibold py-1 px-3 rounded-md transition"
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={handleAddField}
                          className="mt-3 text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-150 shadow-md"
                        >
                          + Add Field
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="py-2">
                <button
                  type="button"
                  className={`w-full flex justify-between items-center text-left section-toggle ${openSections.advanced ? 'open' : ''}`}
                  onClick={() => toggleSection('advanced')}
                >
                  <h2 className="section-title">Advanced</h2>
                  <svg className="w-5 h-5 text-gray-400 chevron" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
                <div className={`section-content mt-4 ${openSections.advanced ? 'open' : ''}`}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-300 mb-2">Flags</h3>
                      <div className="flex items-center gap-2 mb-2">
                        <input
                          type="checkbox"
                          checked={suppressEmbeds}
                          onChange={event => setSuppressEmbeds(event.target.checked)}
                          className="h-4 w-4 rounded bg-gray-600 border-gray-500 text-indigo-600 focus:ring-indigo-500"
                        />
                        <label className="text-sm text-gray-300">Suppress Embeds</label>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={suppressNotifications}
                          onChange={event => setSuppressNotifications(event.target.checked)}
                          className="h-4 w-4 rounded bg-gray-600 border-gray-500 text-indigo-600 focus:ring-indigo-500"
                        />
                        <label className="text-sm text-gray-300">Suppress Notifications</label>
                      </div>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-300 mb-2">Message Link</h3>
                      <p className="form-hint mb-2">Editing/loading messages requires bot functionality not available to webhooks.</p>
                      <div className="flex gap-2">
                        <input
                          type="url"
                          placeholder="Discord message URL (feature disabled)"
                          className="flex-grow bg-gray-700 p-2.5 rounded-lg border border-gray-600 focus:ring-indigo-500"
                          disabled
                        />
                        <button
                          type="button"
                          className="bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg cursor-not-allowed"
                          disabled
                        >
                          Load
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-gray-700">
                <button
                  type="button"
                  onClick={() => sendWebhook(true)}
                  disabled={isSending}
                  className="w-full sm:w-auto bg-gray-600 hover:bg-gray-500 disabled:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg transition duration-150 shadow-md"
                >
                  {isSending ? 'Sending...' : 'Test'}
                </button>
                <button
                  type="submit"
                  disabled={isSending}
                  className="w-full sm:w-auto flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg transition duration-150 shadow-md"
                >
                  {isSending ? 'Sending...' : 'Send Message'}
                </button>
              </div>

              {statusMessage && (
                <div
                  id="status-message"
                  className={`mt-6 text-center text-sm p-3 rounded-lg ${
                    statusVariant === 'error' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'
                  }`}
                >
                  {statusMessage}
                </div>
              )}
            </form>
          </div>
        </div>

        <div className="lg:w-2/5 w-full">
          <div className="bg-gray-800 border-gray-700 rounded-2xl shadow-lg p-6 sm:p-8 fade-in sticky top-8">
            <h2 className="text-2xl font-bold text-gray-300 mb-4">Live Preview</h2>
            <div id="preview-container" className="bg-[#36393F] p-4 rounded-lg min-h-[200px] text-white font-sans text-base leading-relaxed">
              <div className="flex items-start">
                <img
                  src={previewAvatar}
                  alt="Avatar"
                  className="w-10 h-10 rounded-full mr-4"
                  onError={event => {
                    event.currentTarget.src = DEFAULT_AVATAR
                  }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline">
                    <span id="preview-username" className="font-semibold text-white mr-2">
                      {previewUsername}
                    </span>
                    <span id="preview-timestamp" className="text-gray-400 text-xs">
                      {previewTimestampText}
                    </span>
                  </div>
                  <div
                    id="preview-message-content"
                    className="text-gray-200 whitespace-pre-wrap prose max-w-none"
                    dangerouslySetInnerHTML={{ __html: previewMessageHTML }}
                  />
                  <div id="preview-embeds-container" className="space-y-2 mt-2">
                    {previewEmbeds.length > 0 ? previewEmbeds : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}