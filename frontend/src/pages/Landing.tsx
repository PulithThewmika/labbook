import { Navigate } from 'react-router-dom'
import { Spinner, btnPrimary, btnSecondary } from '../components/feedback'
import { useAuth } from '../lib/auth'
import { getConfig } from '../lib/config'

const FEATURES = [
  { title: 'See what is free', text: 'Live availability for every lab and piece of equipment, down to the half hour.' },
  { title: 'No double bookings', text: 'The database itself refuses overlapping bookings, so two groups never get the same slot.' },
  { title: 'One approval queue', text: 'Lab admins approve or reject requests in one place, with a note when they decline.' },
]

export default function Landing() {
  const { status, signIn } = useAuth()
  if (status === 'loading') return <Spinner />
  if (status === 'signedIn') return <Navigate to="/labs" replace />
  const dev = getConfig().authMode === 'dev'

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
      <div className="max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">University labs</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">Book labs &amp; equipment in seconds</h1>
        <p className="mt-5 text-lg text-slate-600">
          Stop chasing logbooks and WhatsApp messages. See what is available, request a slot, and get an answer from your lab instructor.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          {dev ? (
            <>
              <button type="button" className={btnPrimary} onClick={() => signIn('student@labbook.dev')}>
                Continue as student
              </button>
              <button type="button" className={btnSecondary} onClick={() => signIn('admin@labbook.dev')}>
                Continue as admin
              </button>
            </>
          ) : (
            <button type="button" className={btnPrimary} onClick={() => signIn()}>
              Sign in
            </button>
          )}
        </div>
        {dev && <p className="mt-3 text-xs text-slate-500">Local development mode: no password needed.</p>}
      </div>
      <ul className="mt-16 grid gap-6 sm:grid-cols-3">
        {FEATURES.map((f) => (
          <li key={f.title} className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="font-semibold text-slate-900">{f.title}</h2>
            <p className="mt-2 text-sm text-slate-600">{f.text}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
