export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            MedAdmit
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">
            Medical School Admissions Predictor
          </p>
        </div>

        {children}

        {/* Footer */}
        <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-8">
          By continuing, you agree to our{' '}
          <a href="/terms" className="underline hover:text-slate-700 dark:hover:text-slate-200">
            Terms of Service
          </a>{' '}
          and{' '}
          <a href="/privacy" className="underline hover:text-slate-700 dark:hover:text-slate-200">
            Privacy Policy
          </a>
        </p>
      </div>
    </div>
  )
}
