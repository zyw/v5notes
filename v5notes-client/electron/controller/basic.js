'use strict';

const { Controller } = require('ee-core');
const Log = require('ee-core/log');
const Services = require('ee-core/services');
const CoreWindow = require('ee-core/electron/window');

/**
 * example
 * @class
 */
class BasicController extends Controller {

    constructor(ctx) {
      super(ctx);
    }


  /**
   * login window
   */
  loginWindow(args) {
    const { width, height } = args;
    const win = CoreWindow.getMainWindow();
    
    const size = {
      width: width || 800,
      height: height || 600
    }
    if(win.isMaximized()) {
      win.restore();
    }
    win.setSize(size.width, size.height);
    win.setResizable(false);
    win.center();
    win.show();
    win.focus();
  }

  /**
   * restore window
   */
  mainWindow(args) {
    const { width, height } = args;
    const win = CoreWindow.getMainWindow();

    const size = {
      width: width || 980,
      height: height || 650
    }
    win.setSize(size.width, size.height);
    win.setResizable(true);
    win.center();
    win.show();
    win.focus();
  }  

  async winStatus() {
    const result = await Services.get('basic').winStatus();
    Log.info('service result:', result);

    return result
  }
}

BasicController.toString = () => '[class BasicController]';
module.exports = BasicController;  