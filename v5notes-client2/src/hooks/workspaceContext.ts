import { inject, provide, type InjectionKey } from 'vue'
import type { useWorkspace } from './useWorkspace'

type WorkspaceState = ReturnType<typeof useWorkspace>
const workspaceKey: InjectionKey<WorkspaceState> = Symbol('workspace')

export function provideWorkspace(state: WorkspaceState): void {
  provide(workspaceKey, state)
}

export function useWorkspaceContext(): WorkspaceState {
  const state = inject(workspaceKey)
  if (!state) throw new Error('Workspace context is unavailable')
  return state
}
