export interface AppConfig {
  apiUrl: string
  authMode: 'dev' | 'oidc'
  timeZone: string
  /** oidc mode: base URL of the identity provider as the browser reaches it, e.g. http://thunder.openchoreo.localhost:8080 */
  oidcAuthority: string
  oidcClientId: string
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
    authMode: c.authMode === 'oidc' ? 'oidc' : 'dev',
    timeZone: c.timeZone ?? 'Asia/Colombo',
    oidcAuthority: c.oidcAuthority ?? '',
    oidcClientId: c.oidcClientId ?? 'labbook-web',
  }
}
