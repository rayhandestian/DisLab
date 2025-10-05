'use client'

import { useAuth } from '@/components/AuthProvider'
import { useSupabase } from '@/hooks/useSupabase'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Profile {
  tier: string
  created_at: string
}

export default function AccountPage() {
  const { user, loading: authLoading, logout } = useAuth()
  const supabase = useSupabase()
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [scheduleCount, setScheduleCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/')
    }
  }, [user, authLoading, router])

  useEffect(() => {
    if (user) {
      fetchData()
    }
  }, [user])

  const fetchData = async () => {
    if (!user) return

    try {
      // Fetch profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('tier, created_at')
        .eq('id', user.id)
        .single()

      setProfile(profileData)

      // Fetch schedule count
      const { count } = await supabase
        .from('schedules')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_active', true)

      setScheduleCount(count || 0)
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getMaxSchedules = (tier: string) => {
    return tier === 'paid' ? 100 : 3
  }

  const getMaxSavedWebhooks = (tier: string) => {
    return tier === 'paid' ? 50 : 10
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading account...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  const avatarUrl = user.user_metadata?.avatar_url || 
    `https://cdn.discordapp.com/embed/avatars/${Math.floor(Math.random() * 5)}.png`
  
  const username = user.user_metadata?.full_name || 
    user.user_metadata?.name || 
    user.email?.split('@')[0] || 
    'User'

  const email = user.email || 'No email'

  return (
    <div className="min-h-screen bg-gray-900 text-white py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link
            href="/"
            className="text-indigo-400 hover:text-indigo-300 transition-colors duration-150 flex items-center gap-2 text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Home
          </Link>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-lg p-6 sm:p-8">
          <h1 className="text-3xl font-bold text-indigo-400 mb-8">Account Profile</h1>

          {/* Profile Information */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">Profile Information</h2>
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 bg-gray-900/50 rounded-lg p-6">
              <img
                src={avatarUrl}
                alt={username}
                className="w-24 h-24 rounded-full border-4 border-indigo-600"
                onError={(e) => {
                  e.currentTarget.src = `https://cdn.discordapp.com/embed/avatars/0.png`
                }}
              />
              <div className="flex-1 text-center sm:text-left">
                <h3 className="text-2xl font-bold text-white mb-2">{username}</h3>
                <p className="text-gray-400 mb-1">{email}</p>
                {profile && (
                  <p className="text-sm text-gray-500">
                    Member since {formatDate(profile.created_at)}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Account Details */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">Account Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-900/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                  <span className="text-sm font-medium text-gray-400">Account Tier</span>
                </div>
                <p className="text-2xl font-bold text-white capitalize">
                  {profile?.tier || 'Free'}
                </p>
              </div>

              <div className="bg-gray-900/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm font-medium text-gray-400">Active Schedules</span>
                </div>
                <p className="text-2xl font-bold text-white">
                  {scheduleCount} / {profile ? getMaxSchedules(profile.tier) : 3}
                </p>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              href="/webhook"
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-150 shadow-md text-center"
            >
              Go to Webhook Sender
            </Link>
            <button
              onClick={logout}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-150 shadow-md"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}