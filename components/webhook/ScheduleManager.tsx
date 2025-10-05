'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSupabase, useUser } from '@/hooks/useSupabase'
import toast from 'react-hot-toast'

import Login from '@/components/Login'
import {
  createSchedule,
  deleteSchedule,
  fetchSchedules,
  getScheduleById,
  updateSchedule,
  type ScheduleRow,
  type StoredFileAttachment,
} from '@/lib/scheduleService'
import {
  hydrateBuilderState,
  type BuilderStateSnapshot,
  type HydratedBuilderState,
} from '@/lib/webhookSerializer'
import {
  createDefaultEmbed,
  embedHasRenderableContent,
  toLocalISOString,
  type EmbedData,
  type WebhookBuilderApi,
} from '@/hooks/useWebhookBuilder'

type ScheduleManagerProps = {
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
  storedFiles: StoredFileAttachment[]
): BuilderStateSnapshot => ({
  content: builder.message,
  username: builder.username,
  avatarUrl: builder.avatarUrl,
  threadName: builder.threadName,
  suppressEmbeds: builder.suppressEmbeds,
  suppressNotifications: builder.suppressNotifications,
  embeds: cloneEmbedData(builder.embedsData),
  files: storedFiles,
})

const defaultScheduleTimeValue = () => toLocalISOString(new Date(Date.now() + 60 * 60 * 1000))

export default function ScheduleManager({ builder }: ScheduleManagerProps) {
  const supabase = useSupabase()
  const { user } = useUser()

  const [schedules, setSchedules] = useState<ScheduleRow[]>([])
  const [loadingSchedules, setLoadingSchedules] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleRow | null>(null)
  const [scheduleName, setScheduleName] = useState('')
  const [scheduleTime, setScheduleTime] = useState('')
  const [existingFiles, setExistingFiles] = useState<StoredFileAttachment[]>([])
  const [removedFiles, setRemovedFiles] = useState<StoredFileAttachment[]>([])

  const newFilesCount = builder.files.length
  const retainedFilesCount = existingFiles.length

  const totalFilesCount = useMemo(
    () => retainedFilesCount + newFilesCount,
    [retainedFilesCount, newFilesCount]
  )

  useEffect(() => {
    if (!user) {
      resetEditorState()
      setSchedules([])
      return
    }
    void loadSchedules()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const loadSchedules = async () => {
    if (!user) return
    try {
      setLoadingSchedules(true)
      const data = await fetchSchedules(supabase, user.id)
      setSchedules(data)
      if (selectedSchedule) {
        const updated = data.find(schedule => schedule.id === selectedSchedule.id)
        if (updated) {
          await applyScheduleToBuilder(updated)
        }
      }
    } catch (error) {
      console.error('Error fetching schedules:', error)
      toast.error('Failed to load schedules')
    } finally {
      setLoadingSchedules(false)
    }
  }

  const resetEditorState = () => {
    setSelectedSchedule(null)
    setScheduleName('')
    setScheduleTime('')
    setExistingFiles([])
    setRemovedFiles([])
    builder.setFiles([])
  }

  const applyBuilderState = (state: HydratedBuilderState) => {
    builder.setMessage(state.content)
    builder.setUsername(state.username)
    builder.setAvatarUrl(state.avatarUrl)
    builder.setThreadName(state.threadName)
    builder.setSuppressEmbeds(state.suppressEmbeds)
    builder.setSuppressNotifications(state.suppressNotifications)
    builder.setEmbedsData(
      state.embeds.length > 0 ? state.embeds : [createDefaultEmbed()]
    )
  }

  const applyScheduleToBuilder = async (schedule: ScheduleRow) => {
    const hydrated = hydrateBuilderState(schedule.builder_state ?? {})
    applyBuilderState(hydrated)
    builder.setFiles([])
    setScheduleName(schedule.name)
    setScheduleTime(toLocalISOString(new Date(schedule.schedule_time)))
    setExistingFiles(schedule.files ?? [])
    setRemovedFiles([])
    setSelectedSchedule(schedule)
  }

  const handleSelectSchedule = async (scheduleId: string) => {
    if (!user) return
    try {
      const schedule = await getScheduleById(supabase, user.id, scheduleId)
      await applyScheduleToBuilder(schedule)
      toast.success(`Editing schedule "${schedule.name}"`)
    } catch (error) {
      console.error('Error loading schedule:', error)
      toast.error('Failed to load schedule')
    }
  }

  const handleToggleExistingFile = (file: StoredFileAttachment) => {
    const isRemoved = removedFiles.some(item => item.storagePath === file.storagePath)
    if (isRemoved) {
      setRemovedFiles(prev => prev.filter(item => item.storagePath !== file.storagePath))
      setExistingFiles(prev => [...prev, file])
    } else {
      setExistingFiles(prev => prev.filter(item => item.storagePath !== file.storagePath))
      setRemovedFiles(prev => [...prev, file])
    }
  }

  const validateScheduleInput = () => {
    if (!hasBuilderContent(builder)) {
      toast.error('Cannot schedule an empty message')
      return false
    }

    const validUrl = builder.getValidWebhookUrl()
    if (!validUrl) return false

    if (!scheduleName.trim()) {
      toast.error('Schedule name is required')
      return false
    }

    if (!scheduleTime) {
      toast.error('Select a schedule time')
      return false
    }

    const scheduledDate = new Date(scheduleTime)
    if (Number.isNaN(scheduledDate.getTime())) {
      toast.error('Invalid schedule time')
      return false
    }

    if (scheduledDate.getTime() < Date.now() - 60 * 1000) {
      toast.error('Schedule time must be in the future')
      return false
    }

    return true
  }

  const handleSaveSchedule = async () => {
    if (!user) return
    if (!validateScheduleInput()) return

    const validUrl = builder.getValidWebhookUrl()
    if (!validUrl) return

    const snapshot = snapshotFromBuilder(builder, existingFiles)

    setSaving(true)
    try {
      let result: ScheduleRow
      if (selectedSchedule) {
        result = await updateSchedule({
          supabase,
          scheduleId: selectedSchedule.id,
          userId: user.id,
          name: scheduleName.trim(),
          webhookUrl: validUrl,
          scheduleTime,
          snapshot,
          retainedFiles: existingFiles,
          filesToRemove: removedFiles,
          newFiles: builder.files,
          isActive: true,
        })
        toast.success('Schedule updated')
      } else {
        result = await createSchedule({
          supabase,
          userId: user.id,
          name: scheduleName.trim(),
          webhookUrl: validUrl,
          scheduleTime,
          snapshot,
          files: builder.files,
        })
        toast.success('Schedule created')
      }

      builder.setFiles([])
      setRemovedFiles([])
      await loadSchedules()
      await applyScheduleToBuilder(result)
    } catch (error) {
      console.error('Error saving schedule:', error)
      toast.error('Failed to save schedule')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteSchedule = async () => {
    if (!user || !selectedSchedule) return
    if (!confirm(`Delete schedule "${selectedSchedule.name}"?`)) return

    setDeleting(true)
    try {
      await deleteSchedule({ supabase, scheduleId: selectedSchedule.id, userId: user.id })
      toast.success('Schedule deleted')
      resetEditorState()
      await loadSchedules()
    } catch (error) {
      console.error('Error deleting schedule:', error)
      toast.error('Failed to delete schedule')
    } finally {
      setDeleting(false)
    }
  }

  const handleNewSchedule = () => {
    resetEditorState()
    setScheduleTime(defaultScheduleTimeValue())
    toast.success('Creating new schedule')
  }

  useEffect(() => {
    if (!selectedSchedule) {
      setScheduleTime(prev => prev || defaultScheduleTimeValue())
    }
  }, [selectedSchedule])

  if (!user) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 sm:p-8 mt-6">
        <h2 className="text-2xl font-semibold text-indigo-400 mb-4">Schedule Webhooks</h2>
        <p className="text-gray-300 mb-6">
          Login with Discord to save webhook schedules and manage your upcoming messages.
        </p>
        <Login />
      </div>
    )
  }

  const hasRemovedFiles = removedFiles.length > 0

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 sm:p-8 mt-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-indigo-400">Schedule Webhooks</h2>
          <p className="text-gray-400">
            Save this configuration to run later via Supabase cron. Files: {totalFilesCount}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleNewSchedule}
            className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg transition duration-150"
          >
            New Schedule
          </button>
          {selectedSchedule && (
            <button
              type="button"
              onClick={handleDeleteSchedule}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 disabled:bg-red-800 text-white font-semibold py-2 px-4 rounded-lg transition duration-150"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-4">
          <div>
            <label className="form-label">Schedule Name</label>
            <input
              type="text"
              value={scheduleName}
              onChange={event => setScheduleName(event.target.value)}
              placeholder="Weekly status update"
              className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="form-label">Schedule Time</label>
            <input
              type="datetime-local"
              value={scheduleTime}
              onChange={event => setScheduleTime(event.target.value)}
              className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <p className="form-hint mt-1">
              Uses your local timezone. Cron runs every minute via Supabase.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={handleSaveSchedule}
              disabled={saving}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white font-bold py-3 px-4 rounded-lg transition duration-150 shadow-md"
            >
              {saving
                ? 'Saving...'
                : selectedSchedule
                  ? 'Update Schedule'
                  : 'Create Schedule'}
            </button>
            <button
              type="button"
              onClick={() => builder.setFiles([])}
              className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 px-4 rounded-lg transition duration-150"
            >
              Clear New Files
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <h3 className="text-lg font-semibold text-gray-200 mb-2">Existing Attachments</h3>
            {existingFiles.length === 0 && removedFiles.length === 0 ? (
              <p className="text-sm text-gray-400">No stored files for this schedule.</p>
            ) : (
              <div className="space-y-2">
                {existingFiles.map(file => (
                  <div
                    key={file.storagePath}
                    className="flex items-center justify-between bg-gray-900/40 border border-gray-700 rounded-lg px-3 py-2"
                  >
                    <div>
                      <p className="text-sm text-white">{file.name}</p>
                      <p className="text-xs text-gray-400">
                        {(file.size / 1024).toFixed(1)} KB • {file.mimeType}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleExistingFile(file)}
                      className="text-xs bg-red-600/80 hover:bg-red-600 text-white font-semibold py-1 px-3 rounded-md transition"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                {removedFiles.map(file => (
                  <div
                    key={`${file.storagePath}-removed`}
                    className="flex items-center justify-between bg-red-900/30 border border-red-700 rounded-lg px-3 py-2"
                  >
                    <div>
                      <p className="text-sm text-white line-through">{file.name}</p>
                      <p className="text-xs text-gray-300">Marked for deletion</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleExistingFile(file)}
                      className="text-xs bg-gray-700 hover:bg-gray-600 text-white font-semibold py-1 px-3 rounded-md transition"
                    >
                      Restore
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          {newFilesCount > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-200 mb-2">New Attachments</h3>
              <ul className="space-y-2">
                {builder.files.map((file: File, index: number) => (
                  <li key={`${file.name}-${index}`} className="text-sm text-gray-300">
                    {file.name} • {(file.size / 1024).toFixed(1)} KB
                  </li>
                ))}
              </ul>
            </div>
          )}
          {hasRemovedFiles && (
            <p className="text-xs text-yellow-400">
              Removed files will be deleted when you update the schedule.
            </p>
          )}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-200 mb-3">
          Saved Schedules
        </h3>
        {loadingSchedules ? (
          <p className="text-sm text-gray-400">Loading schedules...</p>
        ) : schedules.length === 0 ? (
          <p className="text-sm text-gray-400">
            No schedules yet. Configure your webhook above and create your first schedule.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-700">
              <thead>
                <tr className="bg-gray-900/60 text-left text-xs uppercase tracking-wider text-gray-400">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Scheduled For</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {schedules.map(schedule => {
                  const scheduledDate = new Date(schedule.schedule_time)
                  const scheduledLabel = scheduledDate.toLocaleString()
                  return (
                    <tr key={schedule.id} className="text-sm text-gray-200">
                      <td className="px-4 py-3">
                        <div className="font-medium text-white">{schedule.name}</div>
                        <div className="text-xs text-gray-400">{schedule.webhook_url}</div>
                      </td>
                      <td className="px-4 py-3">{scheduledLabel}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            schedule.is_active ? 'bg-green-900/60 text-green-300' : 'bg-gray-800 text-gray-400'
                          }`}
                        >
                          {schedule.is_active ? 'Active' : 'Sent'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleSelectSchedule(schedule.id)}
                            className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-1 px-3 rounded-md transition"
                          >
                            Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}