
/**
 * 主进程与渲染进程通信频道定义
 * Definition of communication channels between main process and rendering process
 */
const ipcApiRoute = {
  // basic
  loginWindow: 'controller.basic.loginWindow',
  mainWindow: 'controller.basic.mainWindow',
  winStatus: 'controller.basic.winStatus',
}

const specialIpcRoute = {
  onUpdateMaximize: 'update-maximize', // updater channel
}

const ipcEvents = {
  close: 'close',  // 关闭窗口
  minimize: 'minimize', // 最小化窗口 on 为单向，handle为双向
  maximize: 'maximize', // 最大化窗口
  restore: 'restore', // 还原窗口
  enterFullscreen: 'enter-fullscreen', // 进入全屏
  exitFullscreen: 'exit-fullscreen', // 退出全屏
  getPlatform: 'get-platform', // 获取操作系统平台信息
}
  
export {
  ipcApiRoute,
  specialIpcRoute,
  ipcEvents
}
  
  