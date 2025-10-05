'use client'

import { useState, useEffect } from 'react'
import { useSupabase, useUser } from '@/hooks/useSupabase'
import toast from 'react-hot-toast'
import { createSchedule } from '@/lib/scheduleService'
import type { RecurrencePattern, RecurrenceConfig } from '@/lib/types/schedule'
import RecurrenceSelector from './RecurrenceSelector'

interface ScheduleData {
  name: string
  webhookUrl: string
  message: string
  username?: string
  avatarUrl?: string
  scheduleTime: string
}

interface Profile {
  tier: string
}

export default function ScheduleForm({ onSuccess }: { onSuccess: () => void }) {
  const supabase = useSupabase()
  const { user } = useUser()
  const [loading, setLoading] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [scheduleCount, setScheduleCount] = useState(0)
  const [data, setData] = useState<ScheduleData>({
    name: '',
    webhookUrl: '',
    message: '',
    username: '',
    avatarUrl: '',
    scheduleTime: ''
  })
  
  // Recurrence state
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurrencePattern, setRecurrencePattern] = useState<RecurrencePattern>('once')
  const [recurrenceConfig, setRecurrenceConfig] = useState<RecurrenceConfig>({})
  const [maxExecutions, setMaxExecutions] = useState<number | undefined>(undefined)

  useEffect(() => {
    if (user) {
      fetchProfile()
      fetchScheduleCount()
    }
  }, [user])

  const fetchProfile = async () => {
    if (!user) return
    const { data } = await supabase
      .from('profiles')
      .select('tier')
      .eq('id', user.id)
      .single()
    setProfile(data)
  }

  const fetchScheduleCount = async () => {
    if (!user) return
    const { count } = await supabase
      .from('schedules')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_active', true)
    setScheduleCount(count || 0)
  }

  const getMaxSchedules = (tier: string) => {
    return tier === 'paid' ? 100 : 3
  }

  const sendWebhook = async () => {
    const payload = {
      content: data.message,
      username: data.username || undefined,
      avatar_url: data.avatarUrl || undefined
    }

    const response = await fetch(data.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    if (response.ok) {
      toast.success('Webhook sent successfully!')
    } else {
      toast.error('Failed to send webhook')
    }
  }

  const handleSendNow = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await sendWebhook()
      setData({
        name: '',
        webhookUrl: '',
        message: '',
        username: '',
        avatarUrl: '',
        scheduleTime: ''
      })
    } catch (error) {
      console.error('Error sending webhook:', error)
      toast.error('Error sending webhook')
    } finally {
      setLoading(false)
    }
  }

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !profile) return

    const maxSchedules = getMaxSchedules(profile.tier)
    if (scheduleCount >= maxSchedules) {
      toast.error(`You've reached the limit of ${maxSchedules} schedules for your ${profile.tier} tier.`)
      return
    }

    setLoading(true)
    try {
      // Create snapshot from form data
      const snapshot = {
        content: data.message,
        username: data.username || '',
        avatarUrl: data.avatarUrl || '',
        threadName: '',
        suppressEmbeds: false,
        suppressNotifications: false,
        embeds: [],
        files: []
      }

      await createSchedule({
        supabase,
        userId: user.id,
        name: data.name,
        webhookUrl: data.webhookUrl,
        scheduleTime: data.scheduleTime,
        snapshot,
        files: [],
        isRecurring,
        recurrencePattern,
        recurrenceConfig: isRecurring ? recurrenceConfig : undefined,
        maxExecutions: isRecurring ? maxExecutions : undefined,
      })

      toast.success('Schedule created successfully!')
      onSuccess()
      fetchScheduleCount()
      setData({
        name: '',
        webhookUrl: '',
        message: '',
        username: '',
        avatarUrl: '',
        scheduleTime: ''
      })
      setIsRecurring(false)
      setRecurrencePattern('once')
      setRecurrenceConfig({})
      setMaxExecutions(undefined)
    } catch (error) {
      console.error('Error creating schedule:', error)
      toast.error('Failed to save schedule')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="form-label">Webhook URL</label>
        <input
          type="url"
          value={data.webhookUrl}
          onChange={(e) => setData({ ...data, webhookUrl: e.target.value })}
          className="bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 block w-full p-3"
          required
        />
      </div>

      <div>
        <label className="form-label">Message</label>
        <textarea
          value={data.message}
          onChange={(e) => setData({ ...data, message: e.target.value })}
          rows={4}
          className="bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 block w-full p-3"
          required
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="form-label">Username (Optional)</label>
          <input
            type="text"
            value={data.username}
            onChange={(e) => setData({ ...data, username: e.target.value })}
            className="bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 block w-full p-3"
          />
        </div>
        <div>
          <label className="form-label">Avatar URL (Optional)</label>
          <input
            type="url"
            value={data.avatarUrl}
            onChange={(e) => setData({ ...data, avatarUrl: e.target.value })}
            className="bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 block w-full p-3"
          />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={handleSendNow}
          disabled={loading || !data.webhookUrl || !data.message}
          className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg transition duration-150 shadow-md"
        >
          {loading ? 'Sending...' : 'Send Now'}
        </button>

        {user && (
          <div className="w-full space-y-4">
            <div>
              <label className="form-label">Schedule Name</label>
              <input
                type="text"
                value={data.name}
                onChange={(e) => setData({ ...data, name: e.target.value })}
                className="bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 block w-full p-3"
                placeholder="Schedule name"
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

            {/* Start time */}
            <div>
              <label className="form-label">
                {isRecurring ? 'Start Time' : 'Schedule Time'}
              </label>
              <input
                type="datetime-local"
                value={data.scheduleTime}
                onChange={(e) => setData({ ...data, scheduleTime: e.target.value })}
                className="bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 block w-full p-3"
              />
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
                  className="bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 block w-full p-3"
                />
                <p className="form-hint mt-1">
                  Schedule will stop after this many executions
                </p>
              </div>
            )}

            <button
              onClick={handleSchedule}
              disabled={loading || !data.name || !data.scheduleTime || !data.webhookUrl || !data.message}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg transition duration-150 shadow-md"
            >
              {loading ? 'Scheduling...' : 'Create Schedule'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}