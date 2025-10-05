'use client'

import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { useState } from 'react'

const buildRedirectTo = () => {
  const envUrl =
    (process.env.NEXT_PUBLIC_SITE_URL && process.env.NEXT_PUBLIC_SITE_URL.trim().length > 0
      ? process.env.NEXT_PUBLIC_SITE_URL
      : undefined) ??
    (process.env.NEXT_PUBLIC_VERCEL_URL && process.env.NEXT_PUBLIC_VERCEL_URL.trim().length > 0
      ? process.env.NEXT_PUBLIC_VERCEL_URL
      : undefined)

  if (envUrl) {
    const sanitized = envUrl.trim()
    const withProtocol = /^https?:\/\//i.test(sanitized) ? sanitized : `https://${sanitized}`
    const base = withProtocol.replace(/\/$/, '')
    return `${base}/auth/callback`
  }

  if (typeof window !== 'undefined') {
    return `${window.location.origin}/auth/callback`
  }

  return '/auth/callback'
}

export default function Login() {
  const supabase = useSupabaseClient()
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    setLoading(true)
    const targetRedirect = buildRedirectTo()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        redirectTo: targetRedirect
      }
    })

    if (error) {
      console.error('Error logging in:', error)
      setLoading(false)
      return
    }

    // Supabase will automatically redirect to Discord OAuth
    // No need to manually handle the redirect
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-gray-800 rounded-2xl shadow-lg p-8 text-center">
        <h1 className="text-3xl font-bold text-indigo-400 mb-4">DisLab</h1>
        <p className="text-gray-400 mb-8">
          Schedule Discord webhooks and manage your Discord tools. Login with Discord to get started.
        </p>
        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg transition duration-150 shadow-md flex items-center justify-center gap-2"
        >
          {loading ? (
            'Loading...'
          ) : (
            <>
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 1-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z" />
              </svg>
              Login with Discord
            </>
          )}
        </button>
      </div>
    </div>
  )
}