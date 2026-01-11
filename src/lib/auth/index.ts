import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { User } from '@/types/database'

/**
 * Get the current authenticated user from server context
 * Redirects to login if not authenticated
 */
export async function getUser(): Promise<User> {
  // Development mode: return mock user
  if (process.env.DEV_SKIP_AUTH === 'true') {
    return {
      id: 'dev-user-123',
      email: 'dev@medadmit.local',
      email_verified: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_login_at: new Date().toISOString(),
      subscription_tier: 'premium',
      subscription_expires_at: null,
    }
  }

  const supabase = await createClient()

  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

  if (authError || !authUser) {
    redirect('/login')
  }

  const { data: user, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single()

  if (userError || !user) {
    // User exists in auth but not in users table - should not happen
    // due to trigger, but handle gracefully
    console.error('User not found in database:', userError)
    redirect('/login')
  }

  return user
}

/**
 * Get the current authenticated user from server context
 * Returns null if not authenticated (doesn't redirect)
 */
export async function getUserOptional(): Promise<User | null> {
  // Development mode: return mock user
  if (process.env.DEV_SKIP_AUTH === 'true') {
    return {
      id: 'dev-user-123',
      email: 'dev@medadmit.local',
      email_verified: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_login_at: new Date().toISOString(),
      subscription_tier: 'premium',
      subscription_expires_at: null,
    }
  }

  const supabase = await createClient()

  const { data: { user: authUser } } = await supabase.auth.getUser()

  if (!authUser) {
    return null
  }

  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single()

  return user
}

/**
 * Check if user has premium subscription
 */
export function isPremium(user: User): boolean {
  if (!user.subscription_tier || user.subscription_tier === 'free') {
    return false
  }

  if (user.subscription_expires_at) {
    const expiresAt = new Date(user.subscription_expires_at)
    if (expiresAt < new Date()) {
      return false
    }
  }

  return true
}

/**
 * Check subscription tier
 */
export function getSubscriptionTier(user: User): 'free' | 'premium' | 'professional' {
  if (!isPremium(user)) {
    return 'free'
  }
  return user.subscription_tier as 'premium' | 'professional'
}
