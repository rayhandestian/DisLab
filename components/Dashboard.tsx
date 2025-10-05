'use client'

import { useSupabase, useUser } from '@/hooks/useSupabase'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import ScheduleList from './ScheduleList'
import Login from './Login'

interface Profile {
  tier: string
}

export default function Dashboard() {
  const supabase = useSupabase()
  const { user } = useUser()
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [scheduleCount, setScheduleCount] = useState(0)

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

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }


  const getMaxSchedules = (tier: string) => {
    return tier === 'paid' ? 100 : 3
  }

  const getMaxSavedWebhooks = (tier: string) => {
    return tier === 'paid' ? 50 : 10
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-indigo-400">DisLab</h1>
          <div className="flex items-center gap-4">
            {user && profile && (
              <div className="text-sm text-gray-400">
                Tier: {profile.tier} | Schedules: {scheduleCount}/{getMaxSchedules(profile.tier)}
              </div>
            )}
            {user && (
              <button
                onClick={handleLogout}
                className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-150"
              >
                Logout
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-gray-800 rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Create & Schedule Webhooks</h2>
            <p className="text-gray-400 mb-4">
              Go to the Webhook page to create webhook configurations and schedule them for automated delivery.
            </p>
            <button
              onClick={() => router.push('/webhook')}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-150"
            >
              Go to Webhook Page
            </button>
          </div>

          <div className="bg-gray-800 rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-white mb-4">
              {user ? 'Your Schedules' : 'Login for Scheduling'}
            </h2>
            {user ? (
              <ScheduleList />
            ) : (
              <div className="text-center">
                <p className="text-gray-400 mb-4">Login with Discord to schedule webhooks</p>
                <Login />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}