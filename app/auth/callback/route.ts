import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

const sanitizeBaseUrl = (url: string) => {
  const trimmed = url.trim()
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  return withProtocol.replace(/\/$/, '')
}

const resolveBaseUrl = (request: NextRequest, origin: string) => {
  const envUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.SITE_URL ??
    process.env.NEXT_PUBLIC_VERCEL_URL ??
    process.env.VERCEL_URL

  if (envUrl && envUrl.trim().length > 0) {
    try {
      return sanitizeBaseUrl(envUrl)
    } catch {
      // fall through to headers/origin
    }
  }

  const forwardedHost = request.headers.get('x-forwarded-host')
  if (forwardedHost && forwardedHost.trim().length > 0) {
    const forwardedProto = request.headers.get('x-forwarded-proto') ?? 'https'
    return `${forwardedProto}://${forwardedHost}`
  }

  return sanitizeBaseUrl(origin)
}

const buildRedirectUrl = (baseUrl: string, nextPath: string) => {
  const normalizedNext = nextPath.startsWith('/') ? nextPath : `/${nextPath}`
  return `${baseUrl}${normalizedNext}`
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  console.log('[AUTH CALLBACK] Received request:', {
    url: request.url,
    code: code ? 'present' : 'missing',
    next,
    origin,
    allParams: Object.fromEntries(searchParams.entries())
  })

  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )

  // If there's a code, try to exchange it for a session
  if (code) {
    console.log('[AUTH CALLBACK] Attempting to exchange code for session...')
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (error) {
      console.error('[AUTH CALLBACK] Error exchanging code:', {
        message: error.message,
        status: error.status,
        name: error.name
      })
    } else {
      console.log('[AUTH CALLBACK] Successfully exchanged code, session:', {
        hasSession: !!data.session,
        userId: data.session?.user?.id
      })
      const baseUrl = resolveBaseUrl(request, origin)
      const redirectUrl = buildRedirectUrl(baseUrl, next)
      console.log('[AUTH CALLBACK] Redirecting to:', redirectUrl)
      return NextResponse.redirect(redirectUrl)
    }
  } else {
    console.log('[AUTH CALLBACK] No code parameter found')
  }

  // If no code, check if there's already a session (Supabase may have set cookies)
  console.log('[AUTH CALLBACK] Checking for existing session...')
  const { data: { session } } = await supabase.auth.getSession()
  if (session) {
    console.log('[AUTH CALLBACK] Found existing session, userId:', session.user?.id)
    const baseUrl = resolveBaseUrl(request, origin)
    const redirectUrl = buildRedirectUrl(baseUrl, next)
    console.log('[AUTH CALLBACK] Redirecting to:', redirectUrl)
    return NextResponse.redirect(redirectUrl)
  }

  // No code and no session, redirect to error
  console.error('[AUTH CALLBACK] No code and no session found, redirecting to error page')
  const baseUrl = resolveBaseUrl(request, origin)
  const errorUrl = buildRedirectUrl(baseUrl, '/auth/auth-code-error')
  console.log('[AUTH CALLBACK] Error redirect URL:', errorUrl)
  return NextResponse.redirect(errorUrl)
}