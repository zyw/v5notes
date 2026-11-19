/**
 * The plugin host is created by the workspace, and the settings page reads its
 * list from memory. Opening settings without a workspace-mounted host (welcome
 * screen, or before the workspace mounted) used to leave 插件与安全 permanently
 * empty, so the settings page starts the host itself when it is missing.
 */
export type RuntimeBootDecision = 'reuse' | 'restart' | 'start' | 'unavailable'

/**
 * A host left over for another vault is rebuilt rather than reused: the list
 * would otherwise show the previous vault's plugins, or none.
 */
export function decideRuntimeBoot(options: {
  rootPath: string | null | undefined
  hostPresent: boolean
  hostRoot?: string | null
}): RuntimeBootDecision {
  if (!options.rootPath) return 'unavailable'
  if (!options.hostPresent) return 'start'
  return options.hostRoot && options.hostRoot !== options.rootPath ? 'restart' : 'reuse'
}
