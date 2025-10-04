import { createServerSupabaseClient } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import Dashboard from '@/components/Dashboard'
import Login from '@/components/Login'

export default async function Home() {
  const supabase = createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (session) {
    return <Dashboard />
  } else {
    return <Login />
  }
}
