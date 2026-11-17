export interface AppConfig {
  apiUrl: string
  authMode: 'dev' | 'choreo'
  timeZone: string
}

declare global {
  interface Window {
    configs?: Partial<AppConfig>
  }
}

// Read at call time so tests can change window.configs.
export function getConfig(): AppConfig {
  const c = window.configs ?? {}
  return {
    apiUrl: c.apiUrl ?? '/api',
    authMode: c.authMode === 'choreo' ? 'choreo' : 'dev',
    timeZone: c.timeZone ?? 'Asia/Colombo',
  }
}
