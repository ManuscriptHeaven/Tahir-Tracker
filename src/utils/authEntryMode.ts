/**
 * Decide whether the public authentication entry point should open registration
 * immediately. Cloudflare Pages serves /signup through the existing SPA fallback.
 */
export function resolveAuthEntryMode(pathname: string, search: string): 'welcome' | 'signup' {
  const normalizedPath = pathname.replace(/\/+$/, '') || '/';
  const params = new URLSearchParams(search);
  return normalizedPath === '/signup' || params.get('signup') === '1'
    ? 'signup'
    : 'welcome';
}
