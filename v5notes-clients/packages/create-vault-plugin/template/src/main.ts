// @ts-nocheck -- Plugin 由宿主在加载时注入，源码里没有它的值。
import type { PluginManifest } from '@v5notes/vault-plugin-api';

/**
 * {{NAME}}
 *
 * {{DESCRIPTION}}
 *
 * 宿主契约（详见 docs/vault-plugin-development.md）：
 * - 宿主用 new Function 加载 main.js 并注入 Plugin，这里直接 extends Plugin；
 * - 禁止顶层副作用：每次启用都会重新执行 onload；
 * - add* / register* 注册的东西由宿主统一拆除；
 *   自己的定时器、监听器用 this.register(() => ...) 交出去。
 */
class {{CLASS}} extends Plugin {
  manifest: PluginManifest;

  async onload() {
    this.addCommand({
      id: 'greet',
      name: '打个招呼',
      callback: () => {
        const file = this.app.workspace.getActiveFile();
        this.app.workspace.openNotice(file ? '当前笔记：' + file.path : 'Hello Vault');
      },
    });
{{#RIBBON}}
    this.addRibbonIcon({
      id: 'ribbon',
      title: '{{NAME}}',
      icon: '◆',
      callback: () => this.app.workspace.openNotice('{{NAME}}'),
    });
{{/RIBBON}}
{{#SETTINGS}}
    this.addSettingTab({
      id: 'settings',
      name: '{{NAME}}',
      display: (el) => {
        el.textContent = '插件设置放在这里';
      },
    });
{{/SETTINGS}}
  }

  onunload() {
    // 注册面由宿主拆除，这里只释放自己的句柄。
  }
}

/**
 * 加载器要的形状是 module.exports = class ... extends Plugin。
 * build.mjs 会把下面这行改写成 module.exports = {{CLASS}};
 */
export default {{CLASS}};
