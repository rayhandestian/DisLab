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
    <div className="min-h-screen text-white p-8 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-10 right-10 w-96 h-96 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full mix-blend-multiply filter blur-3xl animate-float"></div>
        <div className="absolute bottom-10 left-10 w-96 h-96 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full mix-blend-multiply filter blur-3xl animate-float" style={{animationDelay: '1.5s'}}></div>
      </div>

      <div className="max-w-4xl mx-auto relative z-10">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold gradient-text">DisLab</h1>
          <div className="flex items-center gap-4">
            {user && profile && (
              <div className="glass px-4 py-2 rounded-lg text-sm text-gray-200">
                Tier: {profile.tier} | Schedules: {scheduleCount}/{getMaxSchedules(profile.tier)}
              </div>
            )}
            {user && (
              <button
                onClick={handleLogout}
                className="neumorph px-4 py-2 rounded-lg text-red-300 hover:text-red-200 transition-all duration-300 transform hover:scale-105"
              >
                Logout
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="glass-card p-6 interactive-card">
            <h2 className="text-xl font-semibold text-white mb-4">Create & Schedule Webhooks</h2>
            <p className="text-gray-300 mb-4">
              Go to the Webhook page to create webhook configurations and schedule them for automated delivery.
            </p>
            <button
              onClick={() => router.push('/webhook')}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 neumorph-flat"
            >
              Go to Webhook Page
            </button>
          </div>

          <div className="glass-card p-6 interactive-card">
            <h2 className="text-xl font-semibold text-white mb-4">
              {user ? 'Your Schedules' : 'Login for Scheduling'}
            </h2>
            {user ? (
              <ScheduleList />
            ) : (
              <div className="text-center">
                <p className="text-gray-300 mb-4">Login with Discord to schedule webhooks</p>
                <Login />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}