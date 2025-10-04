'use client'

import { useState, useEffect } from 'react'
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react'
import toast from 'react-hot-toast'

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
  const supabase = useSupabaseClient()
  const user = useUser()
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !profile) return

    const maxSchedules = getMaxSchedules(profile.tier)
    if (scheduleCount >= maxSchedules) {
      toast.error(`You've reached the limit of ${maxSchedules} schedules for your ${profile.tier} tier.`)
      return
    }

    setLoading(true)
    try {
      const messageData = {
        content: data.message,
        username: data.username || undefined,
        avatar_url: data.avatarUrl || undefined
      }

      const { error } = await supabase
        .from('schedules')
        .insert({
          user_id: user.id,
          name: data.name,
          webhook_url: data.webhookUrl,
          message_data: messageData,
          schedule_time: new Date(data.scheduleTime).toISOString()
        })

      if (error) throw error

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
    } catch (error) {
      console.error('Error creating schedule:', error)
      toast.error('Error creating schedule')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="form-label">Schedule Name</label>
        <input
          type="text"
          value={data.name}
          onChange={(e) => setData({ ...data, name: e.target.value })}
          className="bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 block w-full p-3"
          required
        />
      </div>

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

      <div>
        <label className="form-label">Schedule Time</label>
        <input
          type="datetime-local"
          value={data.scheduleTime}
          onChange={(e) => setData({ ...data, scheduleTime: e.target.value })}
          className="bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 block w-full p-3"
          required
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg transition duration-150 shadow-md"
      >
        {loading ? 'Creating...' : 'Create Schedule'}
      </button>
    </form>
  )
}