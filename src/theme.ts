export type Theme = 'light' | 'dark'
export const THEME_KEY = 'msweeper-theme'

/** Follow the system until the player makes an explicit, remembered choice. */
export function createTheme(
  media: MediaQueryList,
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  apply: (theme: Theme) => void,
) {
  let preference: Theme | null = null
  try {
    const saved = storage.getItem(THEME_KEY)
    if (saved === 'light' || saved === 'dark') preference = saved
  } catch { /* Private browsing can disallow storage; the switch still works. */ }
  let current: Theme = preference ?? (media.matches ? 'dark' : 'light')
  apply(current)
  const systemChanged = () => {
    if (preference !== null) return
    current = media.matches ? 'dark' : 'light'
    apply(current)
  }
  media.addEventListener('change', systemChanged)
  return {
    toggle() {
      current = current === 'dark' ? 'light' : 'dark'
      preference = current
      try { storage.setItem(THEME_KEY, current) } catch { /* Session-only fallback. */ }
      apply(current)
    },
    destroy() { media.removeEventListener('change', systemChanged) },
  }
}
