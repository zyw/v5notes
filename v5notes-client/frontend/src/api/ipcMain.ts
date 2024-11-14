
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
  
  export {
    ipcApiRoute,
    specialIpcRoute
  }
  
  