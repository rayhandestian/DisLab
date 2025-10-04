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
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-indigo-400 mb-4">DisLab</h1>
          <p className="text-xl text-gray-300 mb-8">Discord Webhook Tools Made Simple</p>
          <p className="text-gray-400 mb-12 max-w-2xl mx-auto">
            Send Discord webhooks instantly or schedule them for later. No login required for immediate sending,
            Discord authentication needed for scheduled webhooks.
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="bg-gray-800 rounded-2xl p-8 text-center">
            <h2 className="text-2xl font-semibold text-white mb-4">Send Webhook Now</h2>
            <p className="text-gray-400 mb-6">
              Send Discord webhooks immediately with full customization. No login required.
            </p>
            <Link
              href="/webhook"
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-150 shadow-md"
            >
              Send Now
            </Link>
          </div>
        </div>

        <div className="text-center mt-16">
          <p className="text-gray-500">
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
