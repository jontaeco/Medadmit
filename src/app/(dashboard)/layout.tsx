import Link from 'next/link'
import { getUser } from '@/lib/auth'
import { signOut } from '@/lib/auth/actions'
import { Button } from '@/components/ui/button'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getUser()

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-white dark:bg-slate-900">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="font-bold text-xl">
              MedAdmit
            </Link>

            <nav className="hidden md:flex items-center gap-6">
              <Link
                href="/dashboard"
                className="text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              >
                Dashboard
              </Link>
              <Link
                href="/profiles"
                className="text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              >
                Profiles
              </Link>
              <Link
                href="/results"
                className="text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              >
                Results
              </Link>
              <Link
                href="/schools"
                className="text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              >
                Schools
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-600 dark:text-slate-400 hidden sm:inline">
              {user.email}
            </span>
            <form action={signOut}>
              <Button variant="outline" size="sm" type="submit">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t bg-white dark:bg-slate-900 mt-auto">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-slate-500">
              &copy; {new Date().getFullYear()} MedAdmit. All rights reserved.
            </p>
            <div className="flex items-center gap-4">
              <Link
                href="/methodology"
                className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              >
                Methodology
              </Link>
              <Link
                href="/sources"
                className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              >
                Data Sources
              </Link>
              <Link
                href="/privacy"
                className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              >
                Privacy
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
