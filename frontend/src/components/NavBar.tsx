import { NavLink, Link } from 'react-router-dom'
import { DEV_USERS, getDevUser } from '../lib/api'
import { useAuth } from '../lib/auth'
import { getConfig } from '../lib/config'

const link = ({ isActive }: { isActive: boolean }) =>
  `whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ${
    isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
  }`

export function NavBar() {
  const { status, user, isAdmin, signIn, signOut } = useAuth()
  const dev = getConfig().authMode === 'dev'

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <Link to="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight text-slate-900">
          <span className="grid size-7 place-items-center rounded-lg bg-indigo-600 text-sm font-bold text-white" aria-hidden="true">
            L
          </span>
          LabBook
        </Link>

        {status === 'signedIn' && (
          <nav aria-label="Main" className="order-last -mx-1 flex w-full gap-1 overflow-x-auto sm:order-none sm:mx-0 sm:w-auto">
            <NavLink to="/labs" className={link}>
              Labs
            </NavLink>
            <NavLink to="/equipment" className={link}>
              Equipment
            </NavLink>
            <NavLink to="/bookings" className={link}>
              My bookings
            </NavLink>
            {isAdmin && (
              <>
                <span className="mx-1 hidden w-px self-stretch bg-slate-200 sm:block" aria-hidden="true" />
                <NavLink to="/admin" end className={link}>
                  Dashboard
                </NavLink>
                <NavLink to="/admin/approvals" className={link}>
                  Approvals
                </NavLink>
                <NavLink to="/admin/labs" className={link}>
                  Manage labs
                </NavLink>
                <NavLink to="/admin/equipment" className={link}>
                  Manage equipment
                </NavLink>
              </>
            )}
          </nav>
        )}

        <div className="ml-auto flex items-center gap-3">
          {status === 'signedIn' && user && (
            <>
              {dev ? (
                <select
                  aria-label="Switch dev user"
                  className="rounded-md border-0 bg-slate-50 py-1.5 pl-2 pr-8 text-sm text-slate-700 ring-1 ring-slate-300"
                  value={getDevUser() ?? ''}
                  onChange={(e) => signIn(e.target.value)}
                >
                  {DEV_USERS.map((u) => (
                    <option key={u} value={u}>
                      {u.startsWith('admin') ? 'Admin' : 'Student'}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="hidden text-sm text-slate-600 sm:inline">{user.displayName}</span>
              )}
              <button type="button" onClick={signOut} className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100">
                Sign out
              </button>
            </>
          )}
          {status === 'signedOut' && (
            <button
              type="button"
              onClick={() => signIn()}
              className="rounded-lg bg-indigo-600 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Sign in
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
