'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSupabase, useUser } from '@/hooks/useSupabase'
import toast from 'react-hot-toast'

import Login from '@/components/Login'
import RecurrenceSelector from '@/components/RecurrenceSelector'
import {
  createSchedule,
  deleteSchedule,
  fetchSchedules,
  getScheduleById,
  updateSchedule,
  type ScheduleRow,
  type StoredFileAttachment,
  type RecurrencePattern,
  type RecurrenceConfig,
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
  
  // Recurrence state
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurrencePattern, setRecurrencePattern] = useState<RecurrencePattern>('once')
  const [recurrenceConfig, setRecurrenceConfig] = useState<RecurrenceConfig>({})
  const [maxExecutions, setMaxExecutions] = useState<number | undefined>(undefined)

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
    setIsRecurring(false)
    setRecurrencePattern('once')
    setRecurrenceConfig({})
    setMaxExecutions(undefined)
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
    setIsRecurring(schedule.is_recurring || false)
    setRecurrencePattern(schedule.recurrence_pattern || 'once')
    setRecurrenceConfig(schedule.recurrence_config || {})
    setMaxExecutions(schedule.max_executions)
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
          isRecurring,
          recurrencePattern,
          recurrenceConfig: isRecurring ? recurrenceConfig : undefined,
          maxExecutions: isRecurring ? maxExecutions : undefined,
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
          isRecurring,
          recurrencePattern,
          recurrenceConfig: isRecurring ? recurrenceConfig : undefined,
          maxExecutions: isRecurring ? maxExecutions : undefined,
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
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-indigo-400">Schedule Manager</h2>
            <p className="text-gray-400 text-base">
              Automate webhook delivery • Files: {totalFilesCount}
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleNewSchedule}
            className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 px-6 rounded-xl transition duration-150 flex items-center gap-3 text-base"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Schedule
          </button>
          {selectedSchedule && (
            <button
              type="button"
              onClick={handleDeleteSchedule}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 disabled:bg-red-800 text-white font-semibold py-3 px-6 rounded-xl transition duration-150 flex items-center gap-3 text-base"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
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
          {/* Recurring toggle */}
          <div className="flex items-center gap-3">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => {
                  setIsRecurring(e.target.checked)
                  if (!e.target.checked) {
                    setRecurrencePattern('once')
                    setRecurrenceConfig({})
                  }
                }}
                className="w-5 h-5 text-indigo-600 bg-gray-700 border-gray-600 rounded focus:ring-indigo-500"
              />
              <span className="ml-2 text-white font-semibold">Recurring Schedule</span>
            </label>
          </div>

          {/* Recurrence selector */}
          {isRecurring && (
            <RecurrenceSelector
              pattern={recurrencePattern}
              config={recurrenceConfig}
              onPatternChange={setRecurrencePattern}
              onConfigChange={setRecurrenceConfig}
            />
          )}
          
          <div>
            <label className="form-label">
              {isRecurring ? 'Start Time' : 'Schedule Time'}
            </label>
            <input
              type="datetime-local"
              value={scheduleTime}
              onChange={event => setScheduleTime(event.target.value)}
              className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <p className="form-hint mt-1">
              Uses your local timezone. {isRecurring ? 'First execution will be at this time.' : 'Cron runs every minute via Supabase.'}
            </p>
          </div>
          
          {/* Max executions for recurring */}
          {isRecurring && (
            <div>
              <label className="form-label">Max Executions (Optional)</label>
              <input
                type="number"
                min="1"
                value={maxExecutions || ''}
                onChange={(e) => setMaxExecutions(e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder="Leave empty for unlimited"
                className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <p className="form-hint mt-1">
                Schedule will stop after this many executions
              </p>
            </div>
          )}
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
        <div className="flex items-center gap-3 mb-4">
          <div className="w-6 h-6 bg-gray-700 rounded-md flex items-center justify-center">
            <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-200">
            Saved Schedules ({schedules.length})
          </h3>
        </div>

        {loadingSchedules ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
            <span className="ml-3 text-gray-400">Loading schedules...</span>
          </div>
        ) : schedules.length === 0 ? (
          <div className="text-center py-12 bg-gray-900/30 rounded-xl border border-gray-700/50 border-dashed">
            <svg className="w-12 h-12 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-gray-400 mb-2">No schedules yet</p>
            <p className="text-sm text-gray-500">Configure your webhook above and create your first schedule</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {schedules.map(schedule => {
              const scheduledDate = new Date(schedule.next_execution_at || schedule.schedule_time)
              const scheduledLabel = scheduledDate.toLocaleString()
              const isRecurringSchedule = schedule.is_recurring
              const executionInfo = isRecurringSchedule
                ? `${schedule.execution_count || 0} executions`
                : null

              return (
                <div
                  key={schedule.id}
                  className="bg-gray-900/40 border border-gray-700/50 rounded-xl p-6 hover:bg-gray-900/60 transition-all duration-200 cursor-pointer group"
                  onClick={() => handleSelectSchedule(schedule.id)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-white truncate">{schedule.name}</h4>
                        {isRecurringSchedule && (
                          <span className="text-xs bg-indigo-600 text-white px-2 py-0.5 rounded-full flex-shrink-0">
                            Recurring
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 truncate">{schedule.webhook_url}</p>
                      {executionInfo && (
                        <p className="text-xs text-gray-500 mt-1">{executionInfo}</p>
                      )}
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold flex-shrink-0 ${
                        schedule.is_active ? 'bg-green-900/60 text-green-300' : 'bg-gray-800 text-gray-400'
                      }`}
                    >
                      {schedule.is_active ? 'Active' : 'Completed'}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-gray-300">
                      <svg className="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="truncate">{scheduledLabel}</span>
                    </div>

                    {isRecurringSchedule && schedule.recurrence_pattern && (
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <svg className="w-4 h-4 text-gray-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <span className="capitalize">{schedule.recurrence_pattern}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-6 pt-4 border-t border-gray-700/50">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleSelectSchedule(schedule.id)
                      }}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-xl transition duration-150 text-base flex items-center justify-center gap-3 group-hover:bg-indigo-700"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit Schedule
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}