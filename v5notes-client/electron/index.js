const { Application } = require('ee-core');
const { app: electronApp, ipcMain, BrowserWindow } = require('electron')
const os = require('os')

class Index extends Application {

  constructor() {
    super();
    // this === eeApp;
  }

  /**
   * core app have been loaded
   */
  async ready () {
    // do some things
  }

  /**
   * electron app ready
   */
  async electronAppReady () {
    // 最小化窗口 addon/tray/index.js中的mainWindow.on('close', (event)去处理
    ipcMain.on('close', () => {
      BrowserWindow.getFocusedWindow().close()
    })
    // 最小化窗口 on 为单向，handle为双向
    ipcMain.on('minimize', () => {
      BrowserWindow.getFocusedWindow().minimize()
    })
    // 最大化窗口
    ipcMain.on('maximize', () => {
      BrowserWindow.getFocusedWindow().maximize()
    })
    // 还原窗口
    ipcMain.on('restore', () => {
      BrowserWindow.getFocusedWindow().restore()
    })
    
    // 获取操作系统平台信息
    ipcMain.handle('get-platform', () => {
      return os.platform()
    })
  }

  /**
   * main window have been loaded
   */
  async windowReady () {
    // do some things
    // 延迟加载，无白屏
    const winOpt = this.config.windowsOption;
    if (winOpt.show == false) {
      const win = this.electron.mainWindow;
      win.once('ready-to-show', () => {
        win.show();
        win.focus();
      })

      win.on('maximize', () => {
        win.webContents.send('update-maximize', true)
      })

      win.on('unmaximize', () => {
        win.webContents.send('update-maximize', false)
      })
    }
  }

  /**
   * before app close
   */  
  async beforeClose () {
    // do some things

  }
}

Index.toString = () => '[class Index]';
module.exports = Index;