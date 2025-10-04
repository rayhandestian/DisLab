'use client'

import { createClient } from '@/lib/supabase'
import { SessionContextProvider } from '@supabase/auth-helpers-react'

export default function SupabaseProvider({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SessionContextProvider supabaseClient={createClient()}>
      {children}
    </SessionContextProvider>
  )
}