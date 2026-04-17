import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export function createClient() {
  const isServer = typeof window === 'undefined'
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  
  if (isServer && url.includes('localhost')) {
    url = url.replace('localhost', 'host.docker.internal')
  }

  if (!url || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error('Supabase environment variables not set')
  }
  
  return createSupabaseClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}
