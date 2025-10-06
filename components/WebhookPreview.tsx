'use client'

import { useMemo, type ReactNode } from 'react'
import { marked } from 'marked'

import {
  DEFAULT_AVATAR,
  DEFAULT_COLOR,
  embedHasRenderableContent,
  formatTimestampText,
  isValidHexColor,
} from '@/hooks/useWebhookBuilder'
import type { EmbedData } from '@/hooks/useWebhookBuilder'

type WebhookPreviewProps = {
  username?: string
  avatarUrl?: string
  message?: string
  embedsData?: EmbedData[]
  timestampText?: string
}

export default function WebhookPreview({
  username = '',
  avatarUrl = '',
  message = '',
  embedsData = [],
  timestampText = new Date().toLocaleString(),
}: WebhookPreviewProps) {
  const timestampEnabled = Boolean(embedsData.some(embed => embed.timestampValue))
  const previewUsername = username.trim() || 'Bot'
  const previewAvatar = avatarUrl.trim() || DEFAULT_AVATAR

  const previewEmbeds = useMemo<ReactNode[]>(() => {
    return embedsData
      .map(embed => {
        if (!embedHasRenderableContent(embed)) return null

        const colorBar = isValidHexColor(embed.color) ? embed.color : DEFAULT_COLOR
        const fieldElements: ReactNode[] = []
        let inlineBuffer: ReactNode[] = []

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
      .filter(Boolean) as ReactNode[]
  }, [embedsData])

  return (
    <div className="glass-card p-4 rounded-lg min-h-[200px] text-white font-sans text-base leading-relaxed interactive-card">
      <div className="flex items-start">
        <img
          src={previewAvatar}
          alt="Avatar"
          className="w-10 h-10 rounded-full mr-4 neumorph-flat"
          onError={event => {
            event.currentTarget.src = DEFAULT_AVATAR
          }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline">
            <span className="font-semibold text-white mr-2">
              {previewUsername}
            </span>
            <span className="text-gray-300 text-xs">
              {timestampText}
            </span>
          </div>
          {message.trim() && (
            <div
              className="text-gray-100 whitespace-pre-wrap prose max-w-none"
              dangerouslySetInnerHTML={{ __html: marked.parse(message.trim()) }}
            />
          )}
          <div className="space-y-2 mt-2">
            {previewEmbeds.length > 0 ? previewEmbeds : null}
          </div>
        </div>
      </div>
    </div>
  )
}