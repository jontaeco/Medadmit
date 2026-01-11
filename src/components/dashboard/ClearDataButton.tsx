'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

export function ClearDataButton() {
  const [isDeleting, setIsDeleting] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleClearData() {
    if (!confirmed) {
      setConfirmed(true)
      return
    }

    setIsDeleting(true)
    setError(null)

    try {
      const response = await fetch('/api/data/clear', {
        method: 'POST',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to clear data')
      }

      setSuccess(true)
      setConfirmed(false)

      // Refresh the page after 2 seconds
      setTimeout(() => {
        window.location.reload()
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsDeleting(false)
    }
  }

  if (success) {
    return (
      <div className="text-green-700">
        ✓ All data cleared successfully. Refreshing...
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-red-700">{error}</p>
        <Button
          variant="outline"
          onClick={() => {
            setError(null)
            setConfirmed(false)
          }}
        >
          Try Again
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {confirmed && (
        <div className="p-3 rounded-lg bg-red-100 border border-red-300">
          <p className="text-sm text-red-900 font-semibold">
            Are you sure? This cannot be undone.
          </p>
          <p className="text-xs text-red-700 mt-1">
            This will delete all profiles and predictions.
          </p>
        </div>
      )}

      <div className="flex gap-2">
        <Button
          variant="destructive"
          onClick={handleClearData}
          disabled={isDeleting}
        >
          {confirmed ? 'Confirm Delete All' : 'Delete All Data'}
          {isDeleting && ' (Deleting...)'}
        </Button>

        {confirmed && (
          <Button
            variant="outline"
            onClick={() => setConfirmed(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
        )}
      </div>
    </div>
  )
}
