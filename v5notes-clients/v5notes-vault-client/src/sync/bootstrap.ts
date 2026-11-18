/**
 * First-bind bootstrap authority (design §9.3).
 * Never silent whole-vault overwrite.
 */

import type { BootstrapPlan } from './types'

export function planBootstrap(input: {
  cloudHasContent: boolean
  localSyncableFileCount: number
}): BootstrapPlan {
  const { cloudHasContent, localSyncableFileCount } = input
  if (!cloudHasContent) {
    return {
      mode: 'upload-local',
      cloudHasContent: false,
      localFileCount: localSyncableFileCount,
    }
  }
  if (localSyncableFileCount === 0) {
    return {
      mode: 'pull-cloud',
      cloudHasContent: true,
      localFileCount: 0,
    }
  }
  return {
    mode: 'merge-cloud-baseline',
    cloudHasContent: true,
    localFileCount: localSyncableFileCount,
  }
}

export function bootstrapModeLabel(mode: BootstrapPlan['mode']): string {
  switch (mode) {
    case 'upload-local':
      return '云端为空：本机增量上传建立权威'
    case 'pull-cloud':
      return '本机为空：以云端为基线拉取'
    case 'merge-cloud-baseline':
      return '两端都有内容：云端为基线；同路径冲突生成副本；仅本机独有文件再上传'
    default:
      return mode
  }
}
