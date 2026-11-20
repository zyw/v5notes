/**
 * The plugin host is app-level, so the settings page starts it whether or not a
 * vault is open. Opening another vault keeps the same host: extension state is
 * shared, and only the notes a plugin can touch change.
 */
export type RuntimeBootDecision = 'reuse' | 'start'

export function decideRuntimeBoot(options: {
  hostPresent: boolean
  hostRoot?: string | null
  rootPath?: string | null
}): RuntimeBootDecision {
  if (!options.hostPresent) return 'start'
  return 'reuse'
}
