'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ProfileForm } from '@/components/profile/ProfileForm'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function NewProfilePage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(data: any) {
    console.log('Form submitted with data:', data)
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to create profile' }))
        throw new Error(errorData.error || 'Failed to create profile')
      }

      const result = await response.json()
      const profile = result.profile

      if (!profile || !profile.id) {
        throw new Error('Invalid response from server')
      }

      router.push(`/profiles/${profile.id}`)
    } catch (err) {
      console.error('Profile creation error:', err)
      setError(err instanceof Error ? err.message : 'An error occurred')
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Create New Profile</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          Enter your applicant information to get personalized predictions
        </p>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-4">
            <p className="text-red-700">{error}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Applicant Information</CardTitle>
          <CardDescription>
            All data is kept private and used only to generate your predictions.
            Fields marked with * are required.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm onSubmit={handleSubmit} isLoading={isLoading} />
        </CardContent>
      </Card>
    </div>
  )
}
