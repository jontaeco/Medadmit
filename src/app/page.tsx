import Link from 'next/link'
import { getUserOptional } from '@/lib/auth'
import { Button } from '@/components/ui/button'

export default async function HomePage() {
  const user = await getUserOptional()

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {/* Header */}
      <header className="container mx-auto px-4 py-6">
        <nav className="flex items-center justify-between">
          <span className="text-2xl font-bold">MedAdmit</span>
          <div className="flex items-center gap-4">
            {user ? (
              <Link href="/dashboard">
                <Button>Go to Dashboard</Button>
              </Link>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost">Sign in</Button>
                </Link>
                <Link href="/signup">
                  <Button>Get Started</Button>
                </Link>
              </>
            )}
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
            Know Your Chances at{' '}
            <span className="text-blue-600 dark:text-blue-400">Every</span>{' '}
            Medical School
          </h1>

          <p className="text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Data-driven admission predictions powered by AAMC statistics and peer-reviewed research.
            Get your personalized score, school list, and cycle simulation.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup">
              <Button size="lg" className="text-lg px-8">
                Start Free Analysis
              </Button>
            </Link>
            <Link href="/methodology">
              <Button size="lg" variant="outline" className="text-lg px-8">
                See Methodology
              </Button>
            </Link>
          </div>

          <p className="text-sm text-slate-500">
            No credit card required. Free tier includes 3 predictions.
          </p>
        </div>

        {/* Features Grid */}
        <div className="max-w-5xl mx-auto mt-24 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2">Applicant Score</h3>
            <p className="text-slate-600 dark:text-slate-400">
              Get a 0-1000 score based on your GPA, MCAT, experiences, and background with full transparency on how it&apos;s calculated.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2">School List Builder</h3>
            <p className="text-slate-600 dark:text-slate-400">
              Get reach, target, and safety school recommendations for all 160+ MD programs based on your profile.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border">
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2">Cycle Simulator</h3>
            <p className="text-slate-600 dark:text-slate-400">
              Monte Carlo simulation shows expected interviews, acceptances, and probability of getting in.
            </p>
          </div>
        </div>

        {/* Data Sources */}
        <div className="max-w-4xl mx-auto mt-24 text-center">
          <h2 className="text-2xl font-bold mb-4">Grounded in Real Data</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-8">
            Our predictions are based on publicly available AAMC data and peer-reviewed research.
            Every number is cited and sourced.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8 text-slate-400">
            <span className="text-sm font-medium">AAMC FACTS Tables</span>
            <span className="text-slate-300">|</span>
            <span className="text-sm font-medium">Table A-23 GPA/MCAT Grid</span>
            <span className="text-slate-300">|</span>
            <span className="text-sm font-medium">BMC Medical Education 2023</span>
            <span className="text-slate-300">|</span>
            <span className="text-sm font-medium">MSAR Database</span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t mt-24">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-slate-500">
              &copy; {new Date().getFullYear()} MedAdmit. All rights reserved.
            </p>
            <div className="flex items-center gap-6">
              <Link href="/methodology" className="text-sm text-slate-500 hover:text-slate-700">
                Methodology
              </Link>
              <Link href="/sources" className="text-sm text-slate-500 hover:text-slate-700">
                Data Sources
              </Link>
              <Link href="/privacy" className="text-sm text-slate-500 hover:text-slate-700">
                Privacy
              </Link>
              <Link href="/terms" className="text-sm text-slate-500 hover:text-slate-700">
                Terms
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
