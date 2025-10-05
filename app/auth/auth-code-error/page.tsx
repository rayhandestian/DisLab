import Link from 'next/link'

export default function AuthCodeErrorPage() {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <div className="max-w-lg w-full bg-gray-800 text-white rounded-2xl shadow-xl p-10 space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold text-red-400">Unable to complete sign-in</h1>
          <p className="text-gray-300">
            We tried to finish the Discord login process but Supabase reported an error while exchanging the code.
          </p>
        </div>
        <div className="space-y-3 text-gray-300">
          <p>
            This usually happens when the OAuth redirect URL in Supabase or Discord does not match
            <span className="font-semibold text-white"> https://dis-lab.vercel.app/auth/callback</span> or when the link has expired.
          </p>
          <p>
            Double-check the Supabase Auth → URL Configuration settings and try signing in again.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href="/"
            className="flex-1 text-center bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-150"
          >
            Return home
          </Link>
          <Link
            href="/webhook"
            className="flex-1 text-center bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg transition duration-150"
          >
            Try logging in again
          </Link>
        </div>
      </div>
    </div>
  )
}