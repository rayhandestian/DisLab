'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'

import {
  createDefaultEmbed,
  embedHasRenderableContent,
  type WebhookBuilderApi,
} from '@/hooks/useWebhookBuilder'
import { type BuilderStateSnapshot } from '@/lib/webhookSerializer'

type Template = {
  name: string
  description: string
  snapshot: BuilderStateSnapshot
}

const templates: Template[] = [
  {
    name: 'Simple Text Message',
    description: 'A basic webhook message with just text content.',
    snapshot: {
      content: 'Hello from Discord Webhook Sender! This is a simple text message.',
      username: '',
      avatarUrl: '',
      threadName: '',
      suppressEmbeds: false,
      suppressNotifications: false,
      embeds: [createDefaultEmbed()],
    },
  },
  {
    name: 'Moderate Embed',
    description: 'A basic embed with title, description, and image.',
    snapshot: {
      content: '',
      username: 'Bot',
      avatarUrl: '',
      threadName: '',
      suppressEmbeds: false,
      suppressNotifications: false,
      embeds: [
        {
          id: 'moderate-embed',
          authorName: '',
          authorUrl: '',
          authorIconUrl: '',
          title: 'Sample Embed',
          url: '',
          description: 'This is a moderate complexity embed with a title, description, and image.',
          color: '#5865F2',
          imageUrl: 'https://picsum.photos/400/200',
          thumbnailUrl: '',
          footerText: '',
          footerIconUrl: '',
          timestampValue: undefined,
          fields: [],
        },
      ],
    },
  },
  {
    name: 'Comprehensive Embed',
    description: 'A full-featured message with formatted text and multiple embeds.',
    snapshot: {
      content: '**🎉 Welcome to the Advanced Webhook Demo!**\n\nThis message showcases:\n• **Bold text**\n• *Italic text*\n• `Code snippets`\n• Multiple embeds below',
      username: 'Advanced Bot',
      avatarUrl: 'https://i.imgur.com/fKL31aD.png',
      threadName: '',
      suppressEmbeds: false,
      suppressNotifications: false,
      embeds: [
        {
          id: 'comprehensive-embed-1',
          authorName: 'Webhook Master',
          authorUrl: 'https://github.com/your-repo',
          authorIconUrl: 'https://i.imgur.com/fKL31aD.png',
          title: 'Advanced Webhook Example',
          url: 'https://discord.com/developers/docs/resources/webhook',
          description: 'This comprehensive embed demonstrates all available features: author, title, description, color, image, thumbnail, fields, and footer with timestamp.',
          color: '#FF6B6B',
          imageUrl: 'https://media1.tenor.com/m/FLfJEQ0Q8wQAAAAd/rigby-freaky.gif',
          thumbnailUrl: 'https://i.imgur.com/4M34hi2.png',
          footerText: 'Created with Webhook Sender',
          footerIconUrl: 'https://i.imgur.com/fKL31aD.png',
          timestampValue: new Date().toISOString().slice(0, 16),
          fields: [
            {
              id: 'field-1',
              name: 'Feature 1',
              value: 'Description of feature 1',
              inline: true,
            },
            {
              id: 'field-2',
              name: 'Feature 2',
              value: 'Description of feature 2',
              inline: true,
            },
            {
              id: 'field-3',
              name: 'Feature 3',
              value: 'Description of feature 3',
              inline: false,
            },
          ],
        },
        {
          id: 'comprehensive-embed-2',
          authorName: 'Additional Info',
          authorUrl: '',
          authorIconUrl: '',
          title: 'Second Embed',
          url: '',
          description: 'You can have multiple embeds in a single webhook message. Each embed can have its own styling and content.',
          color: '#4ECDC4',
          imageUrl: '',
          thumbnailUrl: '',
          footerText: 'Embed 2 of 2',
          footerIconUrl: '',
          timestampValue: undefined,
          fields: [
            {
              id: 'info-1',
              name: 'Tip',
              value: 'Use different colors for visual distinction',
              inline: false,
            },
          ],
        },
      ],
    },
  },
]

const hasBuilderContent = (builder: WebhookBuilderApi) =>
  builder.message.trim().length > 0 ||
  builder.files.length > 0 ||
  builder.embedsData.some(embedHasRenderableContent)

const applyTemplate = (builder: WebhookBuilderApi, snapshot: BuilderStateSnapshot) => {
  builder.setMessage(snapshot.content)
  builder.setUsername(snapshot.username)
  builder.setAvatarUrl(snapshot.avatarUrl)
  builder.setThreadName(snapshot.threadName)
  builder.setSuppressEmbeds(snapshot.suppressEmbeds)
  builder.setSuppressNotifications(snapshot.suppressNotifications)
  builder.setEmbedsData(snapshot.embeds.length > 0 ? snapshot.embeds : [createDefaultEmbed()])
  builder.setFiles([])
  builder.setActiveEmbedIndex(0)
}

type WebhookTemplatesProps = {
  builder: WebhookBuilderApi
}

export default function WebhookTemplates({ builder }: WebhookTemplatesProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [pendingTemplate, setPendingTemplate] = useState<Template | null>(null)

  const handleUseTemplate = (template: Template) => {
    if (hasBuilderContent(builder)) {
      setPendingTemplate(template)
      setShowConfirm(true)
    } else {
      applyTemplate(builder, template.snapshot)
      toast.success(`Loaded template "${template.name}"`)
    }
  }

  const confirmApplyTemplate = () => {
    if (pendingTemplate) {
      applyTemplate(builder, pendingTemplate.snapshot)
      toast.success(`Loaded template "${pendingTemplate.name}"`)
    }
    setShowConfirm(false)
    setPendingTemplate(null)
  }

  const cancelApplyTemplate = () => {
    setShowConfirm(false)
    setPendingTemplate(null)
  }

  return (
    <>
      <div className="border-b border-gray-700 py-2">
        <button
          type="button"
          className={`w-full flex justify-between items-center text-left section-toggle ${isOpen ? 'open' : ''}`}
          onClick={() => setIsOpen(!isOpen)}
        >
          <h2 className="section-title">Webhook Templates</h2>
          <svg className="w-5 h-5 text-gray-400 chevron" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
        <div className={`section-content mt-4 ${isOpen ? 'open' : ''}`}>
          <p className="text-gray-400 text-sm mb-4">
            Choose from pre-built templates to learn webhook formatting and get started quickly
          </p>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {templates.map((template) => (
              <div
                key={template.name}
                className="bg-gray-900/40 border border-gray-700/50 rounded-xl p-4 hover:bg-gray-900/60 transition-all duration-200"
              >
                <div className="mb-3">
                  <h3 className="font-semibold text-white text-base mb-1">{template.name}</h3>
                  <p className="text-xs text-gray-400 leading-relaxed">{template.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleUseTemplate(template)}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-3 rounded-lg transition duration-150 shadow-md text-sm"
                >
                  Use Template
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-white mb-4">Confirm Overwrite</h3>
            <p className="text-gray-300 mb-6">
              This will overwrite your current webhook configuration. Are you sure you want to continue?
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={cancelApplyTemplate}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-150"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmApplyTemplate}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-150"
              >
                Overwrite
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}