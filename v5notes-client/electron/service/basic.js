'use strict';

const { Service } = require('ee-core');
const CoreWindow = require('ee-core/electron/window');

/**
 * 示例服务（service层为单例）
 * @class
 */
class BasicService extends Service {

  constructor(ctx) {
    super(ctx);
  }

  /**
   * close
   */
  async close() {
    
  }

  async winStatus() {
    const mainWindow = CoreWindow.getMainWindow();
    const isMaximized = mainWindow.isMaximized()
    return isMaximized
  }
}

BasicService.toString = () => '[class BasicService]';
module.exports = BasicService;