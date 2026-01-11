'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'

export type AuthResult = {
  error?: string
  success?: boolean
}

/**
 * Sign up with email and password
 */
export async function signUp(formData: FormData): Promise<AuthResult> {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirmPassword') as string

  // Validation
  if (!email || !password) {
    return { error: 'Email and password are required' }
  }

  if (password !== confirmPassword) {
    return { error: 'Passwords do not match' }
  }

  if (password.length < 8) {
    return { error: 'Password must be at least 8 characters' }
  }

  // Get origin for redirect URL
  const headersList = await headers()
  const origin = headersList.get('origin') || 'http://localhost:3000'

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
    },
  })

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}

/**
 * Sign in with email and password
 */
export async function signIn(formData: FormData): Promise<AuthResult> {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: 'Email and password are required' }
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { error: error.message }
  }

  redirect('/dashboard')
}

/**
 * Sign in with OAuth provider (Google)
 */
export async function signInWithGoogle(): Promise<void> {
  const supabase = await createClient()

  const headersList = await headers()
  const origin = headersList.get('origin') || 'http://localhost:3000'

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin}/auth/callback`,
    },
  })

  if (error) {
    console.error('Google sign in error:', error)
    return
  }

  if (data.url) {
    redirect(data.url)
  }
}

/**
 * Sign out the current user
 */
export async function signOut(): Promise<void> {
  const supabase = await createClient()

  await supabase.auth.signOut()

  redirect('/login')
}

/**
 * Request password reset email
 */
export async function resetPassword(formData: FormData): Promise<AuthResult> {
  const supabase = await createClient()

  const email = formData.get('email') as string

  if (!email) {
    return { error: 'Email is required' }
  }

  const headersList = await headers()
  const origin = headersList.get('origin') || 'http://localhost:3000'

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/reset-password`,
  })

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}

/**
 * Update password (after reset)
 */
export async function updatePassword(formData: FormData): Promise<AuthResult> {
  const supabase = await createClient()

  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirmPassword') as string

  if (!password) {
    return { error: 'Password is required' }
  }

  if (password !== confirmPassword) {
    return { error: 'Passwords do not match' }
  }

  if (password.length < 8) {
    return { error: 'Password must be at least 8 characters' }
  }

  const { error } = await supabase.auth.updateUser({
    password,
  })

  if (error) {
    return { error: error.message }
  }

  redirect('/dashboard')
}
