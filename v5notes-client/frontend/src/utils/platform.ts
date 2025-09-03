/**
 * 平台检测工具
 */
import { ipc as ipcRenderer } from '@/utils/ipcRenderer'

/**
 * 操作系统平台类型
 */
export enum PlatformType {
  WINDOWS = 'win32',  // Windows
  MAC = 'darwin',     // MacOS
  LINUX = 'linux'     // Linux
}

/**
 * 窗口控制按钮风格类型
 */
export enum WindowControlStyle {
  WINDOWS = 'windows',
  MAC = 'mac',
  LINUX = 'linux'
}

/**
 * 获取当前操作系统平台
 */
export async function getPlatform(): Promise<PlatformType> {
  try {
    const platform = await ipcRenderer.invoke('get-platform')
    console.log('Platform---->>:', platform)
    return platform as PlatformType
  } catch (error) {
    console.warn('Failed to get platform, defaulting to Windows:', error)
    return PlatformType.WINDOWS
  }
}

/**
 * 根据平台获取窗口控制按钮风格
 */
export async function getWindowControlStyle(): Promise<WindowControlStyle> {
  const platform = await getPlatform()
  
  switch (platform) {
    case PlatformType.MAC:
      return WindowControlStyle.MAC
    case PlatformType.LINUX:
      return WindowControlStyle.LINUX
    case PlatformType.WINDOWS:
    default:
      return WindowControlStyle.WINDOWS
  }
}

/**
 * 检查是否为 macOS
 */
export async function isMac(): Promise<boolean> {
  const platform = await getPlatform()
  return platform === PlatformType.MAC
}

/**
 * 检查是否为 Windows
 */
export async function isWindows(): Promise<boolean> {
  const platform = await getPlatform()
  return platform === PlatformType.WINDOWS
}

/**
 * 检查是否为 Linux
 */
export async function isLinux(): Promise<boolean> {
  const platform = await getPlatform()
  return platform === PlatformType.LINUX
}

/**
 * 计算窗口高度
 */
export async function calcWindowHeight(winTopHeight:number): Promise<string> {
  const isMacPlatform = await isMac();
  const style = isMacPlatform ? 'calc(100vh - ' + (winTopHeight + 30) + 'px)' : 'calc(100vh - ' + winTopHeight + 'px)';
  return style;
}