'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, Suspense } from 'react'

function HomeContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const code = searchParams.get('code')
    if (code) {
      router.push(`/auth/callback?code=${code}`)
    }
  }, [searchParams, router])

  return (
    <div className="min-h-screen text-white relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-20 left-10 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl animate-float"></div>
        <div className="absolute top-40 right-10 w-72 h-72 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl animate-float" style={{animationDelay: '1s'}}></div>
        <div className="absolute bottom-20 left-1/2 w-72 h-72 bg-indigo-500 rounded-full mix-blend-multiply filter blur-xl animate-float" style={{animationDelay: '2s'}}></div>
      </div>

      <div className="container mx-auto px-4 py-16 relative z-10">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold gradient-text mb-4 animate-shimmer">DisLab</h1>
          <p className="text-xl text-gray-200 mb-8">Discord Webhook Tools Made Simple</p>
          <p className="text-gray-300 mb-12 max-w-2xl mx-auto">
            Send Discord webhooks instantly or schedule them for later. No login required for immediate sending,
            Discord authentication needed for scheduled webhooks.
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="glass-card p-8 text-center interactive-card">
            <h2 className="text-2xl font-semibold text-white mb-4">Webhook Tools</h2>
            <p className="text-gray-300 mb-6">
              Send Discord webhooks immediately with full customization. No login required.
            </p>
            <Link
              href="/webhook"
              className="inline-block bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              Send Now
            </Link>
          </div>
        </div>

        <div className="text-center mt-16">
          <p className="text-gray-400">
            Built with Next.js, Supabase, and Tailwind CSS
          </p>
        </div>
      </div>
    </div>
  )
}

export default function Home() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HomeContent />
    </Suspense>
  )
}
