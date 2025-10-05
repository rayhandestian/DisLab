import { createServerSupabaseClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

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

  if (code) {
    const supabase = createServerSupabaseClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const baseUrl = resolveBaseUrl(request, origin)
      return NextResponse.redirect(buildRedirectUrl(baseUrl, next))
    }
  }

  const baseUrl = resolveBaseUrl(request, origin)
  return NextResponse.redirect(buildRedirectUrl(baseUrl, '/auth/auth-code-error'))
}