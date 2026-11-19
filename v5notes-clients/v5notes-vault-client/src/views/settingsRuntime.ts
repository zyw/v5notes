/**
 * The plugin host is created by the workspace, and the settings page reads its
 * list from memory. Opening settings without a workspace-mounted host (welcome
 * screen, or before the workspace mounted) used to leave 插件与安全 permanently
 * empty, so the settings page starts the host itself when it is missing.
 */
export type RuntimeBootDecision = 'reuse' | 'start' | 'unavailable'

export function decideRuntimeBoot(options: {
  rootPath: string | null | undefined
  hostPresent: boolean
}): RuntimeBootDecision {
  if (!options.rootPath) return 'unavailable'
  return options.hostPresent ? 'reuse' : 'start'
}
