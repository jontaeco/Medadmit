'use client'

import { NativeResultsDisplay } from '@/components/prediction/NativeResultsDisplay'
import type { NativePredictionResponse } from '@/lib/model'

/**
 * Results Display Component (v2.0)
 *
 * Displays prediction results using the v2.0 model format with:
 * - Competitiveness Score (C) on -3 to +3 scale
 * - Two-stage probability: P(interview) × P(accept|interview)
 * - 80% credible intervals
 * - Correlated Monte Carlo simulation results
 */

interface ResultsDisplayProps {
  prediction: NativePredictionResponse
}

export function ResultsDisplay({ prediction }: ResultsDisplayProps) {
  return <NativeResultsDisplay prediction={prediction} />
}
