// Minimal History-API router — no library. There are eight routes, all shapes
// of one page, and every URL is also a real static HTML file (see
// vite.config.ts): a routing library would add a dependency and a second URL
// parser next to routes.ts without doing anything more than this.
//
// Navigating in-app pushes the URL and updates state; the browser's back and
// forward buttons come back through popstate. A direct load simply reads the
// path it was served at.
import { useCallback, useEffect, useState } from 'react'
import { buildPath, parseLocation, type RoutedTool } from './routes'

export function useRoute(): {
  /** The tool the current URL represents, or null for the homepage. */
  tool: RoutedTool | null
  /** Push a new URL without reloading. null goes back to the homepage. */
  navigateToTool: (tool: RoutedTool | null) => void
} {
  const [tool, setTool] = useState<RoutedTool | null>(
    () => parseLocation(window.location.pathname).tool,
  )

  useEffect(() => {
    const onPopState = () => setTool(parseLocation(window.location.pathname).tool)
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const navigateToTool = useCallback((next: RoutedTool | null) => {
    const current = parseLocation(window.location.pathname)
    if (current.tool === next) return
    // The language segment is never changed here: switching language is a real
    // page load (see LanguageSwitcher), because the crawlable HTML differs.
    window.history.pushState(null, '', buildPath({ ...current, tool: next }))
    setTool(next)
  }, [])

  return { tool, navigateToTool }
}
