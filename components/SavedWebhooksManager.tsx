'use client'

import { useEffect, useState } from 'react'
import { useSupabase, useUser } from '@/hooks/useSupabase'
import toast from 'react-hot-toast'

import {
  createSavedWebhook,
  deleteSavedWebhook,
  fetchSavedWebhooks,
  getSavedWebhookById,
  updateSavedWebhook,
  type SavedWebhookRow,
} from '@/lib/savedWebhookService'
import {
  hydrateBuilderState,
  type BuilderStateSnapshot,
} from '@/lib/webhookSerializer'
import {
  createDefaultEmbed,
  embedHasRenderableContent,
  type EmbedData,
  type WebhookBuilderApi,
} from '@/hooks/useWebhookBuilder'
import { type StoredFileAttachment } from '@/lib/scheduleService'

type SavedWebhooksManagerProps = {
  builder: WebhookBuilderApi
}

const hasBuilderContent = (builder: WebhookBuilderApi) =>
  builder.message.trim().length > 0 ||
  builder.files.length > 0 ||
  builder.embedsData.some(embedHasRenderableContent)

const cloneEmbedData = (embeds: EmbedData[]): EmbedData[] =>
  embeds.map(embed => ({
    ...embed,
    fields: embed.fields.map(field => ({ ...field })),
  }))

const snapshotFromBuilder = (
  builder: WebhookBuilderApi,
  storedFiles: StoredFileAttachment[] = [],
  includeWebhookUrl: boolean = false
): BuilderStateSnapshot => {
  const snapshot: BuilderStateSnapshot = {
    content: builder.message,
    username: builder.username,
    avatarUrl: builder.avatarUrl,
    threadName: builder.threadName,
    suppressEmbeds: builder.suppressEmbeds,
    suppressNotifications: builder.suppressNotifications,
    embeds: cloneEmbedData(builder.embedsData),
    files: storedFiles,
  }
  if (includeWebhookUrl) {
    (snapshot as BuilderStateSnapshot & { webhookUrl: string }).webhookUrl = builder.webhookUrl
  }
  return snapshot
}

export default function SavedWebhooksManager({ builder }: SavedWebhooksManagerProps) {
  const supabase = useSupabase()
  const { user } = useUser()

  const [savedWebhooks, setSavedWebhooks] = useState<SavedWebhookRow[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [selectedWebhook, setSelectedWebhook] = useState<SavedWebhookRow | null>(null)
  const [webhookName, setWebhookName] = useState('')
  const [saveWebhookUrl, setSaveWebhookUrl] = useState(false)

  useEffect(() => {
    if (!user) {
      setSavedWebhooks([])
      return
    }
    void loadSavedWebhooks()
  }, [user?.id])

  const loadSavedWebhooks = async () => {
    if (!user) return
    try {
      setLoading(true)
      const data = await fetchSavedWebhooks(supabase, user.id)
      setSavedWebhooks(data)
    } catch (error) {
      console.error('Error fetching saved webhooks:', error)
      toast.error('Failed to load saved webhooks')
    } finally {
      setLoading(false)
    }
  }

  const applyWebhookToBuilder = async (webhook: SavedWebhookRow) => {
    const hydrated = hydrateBuilderState(webhook.builder_state ?? {})
    builder.setMessage(hydrated.content)
    builder.setUsername(hydrated.username)
    builder.setAvatarUrl(hydrated.avatarUrl)
    builder.setThreadName(hydrated.threadName)
    builder.setSuppressEmbeds(hydrated.suppressEmbeds)
    builder.setSuppressNotifications(hydrated.suppressNotifications)
    builder.setEmbedsData(
      hydrated.embeds.length > 0 ? hydrated.embeds : [createDefaultEmbed()]
    )
    builder.setFiles([])
    if (hydrated.webhookUrl) {
      builder.setWebhookUrl(hydrated.webhookUrl)
      setSaveWebhookUrl(true)
    } else {
      setSaveWebhookUrl(false)
    }
    setWebhookName(webhook.name)
    setSelectedWebhook(webhook)
  }

  const handleSelectWebhook = async (webhookId: string) => {
    if (!user) return
    try {
      const webhook = await getSavedWebhookById(supabase, user.id, webhookId)
      await applyWebhookToBuilder(webhook)
      toast.success(`Loaded webhook "${webhook.name}"`)
    } catch (error) {
      console.error('Error loading webhook:', error)
      toast.error('Failed to load webhook')
    }
  }

  const validateWebhookInput = () => {
    if (!hasBuilderContent(builder)) {
      toast.error('Cannot save an empty webhook')
      return false
    }

    if (!webhookName.trim()) {
      toast.error('Webhook name is required')
      return false
    }

    return true
  }

  const handleSaveWebhook = async () => {
    if (!user) return
    if (!validateWebhookInput()) return

    const snapshot = snapshotFromBuilder(builder, [], saveWebhookUrl)

    setSaving(true)
    try {
      let result: SavedWebhookRow
      if (selectedWebhook) {
        result = await updateSavedWebhook({
          supabase,
          webhookId: selectedWebhook.id,
          userId: user.id,
          name: webhookName.trim(),
          snapshot,
          retainedFiles: [], // For simplicity, replace all files
          filesToRemove: selectedWebhook.files || [],
          newFiles: builder.files,
        })
        toast.success('Webhook updated')
      } else {
        result = await createSavedWebhook({
          supabase,
          userId: user.id,
          name: webhookName.trim(),
          snapshot,
          files: builder.files,
        })
        toast.success('Webhook saved')
      }

      builder.setFiles([])
      await loadSavedWebhooks()
      await applyWebhookToBuilder(result)
    } catch (error) {
      console.error('Error saving webhook:', error)
      toast.error('Failed to save webhook')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteWebhook = async () => {
    if (!user || !selectedWebhook) return
    if (!confirm(`Delete webhook "${selectedWebhook.name}"?`)) return

    setDeleting(true)
    try {
      await deleteSavedWebhook({ supabase, webhookId: selectedWebhook.id, userId: user.id })
      toast.success('Webhook deleted')
      setSelectedWebhook(null)
      setWebhookName('')
      await loadSavedWebhooks()
    } catch (error) {
      console.error('Error deleting webhook:', error)
      toast.error('Failed to delete webhook')
    } finally {
      setDeleting(false)
    }
  }

  const handleNewWebhook = () => {
    setSelectedWebhook(null)
    setWebhookName('')
    setSaveWebhookUrl(false)
    builder.setMessage('')
    builder.setUsername('')
    builder.setAvatarUrl('')
    builder.setThreadName('')
    builder.setSuppressEmbeds(false)
    builder.setSuppressNotifications(false)
    builder.setEmbedsData([createDefaultEmbed()])
    builder.setFiles([])
    toast.success('Creating new webhook')
  }

  if (!user) {
    return null // Or a login prompt
  }

  return (
    <div className="glass-card p-6 sm:p-8 mt-6 interactive-card">
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 neumorph rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-semibold gradient-text">Saved Webhooks</h2>
            <p className="text-gray-300 text-base">
              Save your webhook configurations for easy scheduling • {savedWebhooks.length} / 10 saved
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleNewWebhook}
          className="neumorph px-6 py-3 rounded-xl transition-all duration-300 transform hover:scale-105 flex items-center gap-3 text-base text-gray-200 hover:text-white"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Webhook
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 mb-6">
        <div>
          <label className="form-label">Webhook Name</label>
          <input
            type="text"
            value={webhookName}
            onChange={event => setWebhookName(event.target.value)}
            placeholder="My awesome webhook"
            className="w-full neumorph-inset text-white rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-300"
          />
        </div>
        <div className="md:col-span-2">
          <div className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={saveWebhookUrl}
              onChange={event => setSaveWebhookUrl(event.target.checked)}
              className="h-4 w-4 rounded neumorph bg-gray-600 border-gray-500 text-indigo-600 focus:ring-indigo-500 mt-1"
            />
            <div>
              <label className="text-sm text-gray-200">Save Webhook URL</label>
              <p className="text-xs text-yellow-300">Warning: Webhook URLs are sensitive and can be used to send messages to your Discord channel. Only save if necessary.</p>
            </div>
          </div>
        </div>
        <div className="flex items-end gap-3">
          <button
            type="button"
            onClick={handleSaveWebhook}
            disabled={saving || !hasBuilderContent(builder)}
            className="flex-1 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 neumorph-flat"
          >
            {saving
              ? 'Saving...'
              : selectedWebhook
                ? 'Update Webhook'
                : 'Save Webhook'}
          </button>
          {selectedWebhook && (
            <button
              type="button"
              onClick={handleDeleteWebhook}
              disabled={deleting}
              className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 disabled:from-gray-600 disabled:to-gray-700 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 neumorph-flat"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          )}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-100 mb-4">
          Your Saved Webhooks ({savedWebhooks.length})
        </h3>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-400"></div>
            <span className="ml-3 text-gray-300">Loading webhooks...</span>
          </div>
        ) : savedWebhooks.length === 0 ? (
          <div className="text-center py-12 glass-card rounded-xl border border-white/10 border-dashed">
            <svg className="w-12 h-12 text-gray-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            <p className="text-gray-300 mb-2">No saved webhooks yet</p>
            <p className="text-sm text-gray-400">Configure your webhook above and save it for scheduling</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {savedWebhooks.map(webhook => (
              <div
                key={webhook.id}
                className={`glass-card p-6 interactive-card cursor-pointer group ${
                  selectedWebhook?.id === webhook.id ? 'ring-2 ring-indigo-400' : ''
                }`}
                onClick={() => handleSelectWebhook(webhook.id)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center">
                      <h4 className="font-semibold text-white truncate">{webhook.name}</h4>
                      {webhook.builder_state?.webhookUrl && (
                        <svg className="w-4 h-4 text-yellow-300 ml-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      )}
                    </div>
                    <p className="text-xs text-gray-300 truncate">
                      {webhook.files?.length || 0} files • Created {new Date(webhook.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-white/10">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleSelectWebhook(webhook.id)
                    }}
                    className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 neumorph-flat text-base flex items-center justify-center gap-3"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Load Webhook
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}