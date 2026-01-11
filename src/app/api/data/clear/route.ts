import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const user = await getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createClient()

    // Delete all predictions for this user
    await (supabase as any)
      .from('prediction_results')
      .delete()
      .eq('user_id', user.id)

    // Delete all profiles for this user
    await (supabase as any)
      .from('applicant_profiles')
      .delete()
      .eq('user_id', user.id)

    console.log(`[Clear Data] User ${user.id} cleared all profiles and predictions`)

    return NextResponse.json({
      success: true,
      message: 'All profiles and predictions cleared',
    })
  } catch (error) {
    console.error('Clear data error:', error)
    return NextResponse.json(
      { error: 'Failed to clear data' },
      { status: 500 }
    )
  }
}
