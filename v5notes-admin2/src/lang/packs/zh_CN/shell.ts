export default {
  layout: {
    logoSub: '云笔记 · 管理控制台',
    tagsClose: '关闭当前',
    tagsCloseOthers: '关闭其他',
    tagsCloseLeft: '关闭左侧',
    tagsCloseRight: '关闭右侧',
    tagsCloseAll: '全部关闭',
    tagsFullscreen: '全屏显示',
    tagsExitFullscreen: '退出全屏',
    tagsRefresh: '刷新',
    tagsRefreshPage: '刷新页面',
    settingsNav: '菜单导航设置',
    settingsNavLeft: '左侧菜单',
    settingsNavMix: '混合菜单',
    settingsNavTop: '顶部菜单',
    settingsTheme: '主题风格设置',
    settingsThemeColor: '主题颜色',
    settingsRadius: '页面圆角',
    settingsLayout: '系统布局配置',
    settingsTags: '开启 Tags-Views',
    settingsTagsPersist: '持久化标签页',
    settingsTagsIcon: '显示页签图标',
    settingsFixedHeader: '固定 Header',
    settingsLogo: '显示 Logo',
    settingsDynamicTitle: '动态标题',
    settingsFullTable: '全高表格',
    settingsSave: '保存配置',
    settingsReset: '重置配置',
    settingsSaving: '正在保存到本地，请稍候...',
    settingsResetting: '正在清除设置缓存并刷新，请稍候...',
    searchPlaceholder: '菜单搜索，支持标题、URL模糊查询',
    searchFound: '找到',
    searchResults: '个结果',
    searchEmpty: '未找到 "{keyword}" 相关菜单',
    searchEmptyTip: '试试其他关键词或路径',
    searchSwitch: '切换',
    searchSelect: '选择',
    searchClose: '关闭',
    moreMenu: '更多菜单'
  },
  notice: {
    title: '消息盒子',
    readAll: '全部已读',
    system: '系统 {count}',
    notice: '通知 {count}',
    workflow: '工作 {count}',
    message: '消息',
    read: '已读',
    unread: '未读',
    emptyNotice: '暂无通知公告消息',
    emptyWorkflow: '暂无工作流消息',
    emptySystem: '暂无系统消息'
  },
  errorPage: {
    oops404: '404错误!',
    headline404: '找不到网页！',
    info404: '对不起，您正在寻找的页面不存在。尝试检查 URL 的错误，然后按浏览器上的刷新按钮，或在应用里打开其他页面。',
    backHome: '返回首页',
    oops401: '401错误!',
    headline401: '您没有访问权限！',
    info401: '对不起，您没有访问权限，请不要进行非法操作。您可以返回主页面。',
    back: '返回',
    goHome: '回首页'
  },
  error: {
    retry: '重新加载',
    timeout: {
      title: '请求超时',
      message: '服务在预期时间内没有响应，可能是网络较慢或服务繁忙，请重试。'
    },
    network: {
      title: '网络连接异常',
      message: '无法连接到笔记服务，请检查网络或后端是否可用后重试。'
    },
    session: {
      title: '会话已过期',
      message: '登录状态已失效，请重新登录后继续。'
    },
    server: {
      title: '服务暂时不可用',
      message: '服务端返回错误，请稍后重试。',
      messageWithCode: '服务端返回错误（{code}），请稍后重试。'
    },
    unknown: {
      title: '加载失败',
      message: '发生未知错误，请重试。'
    }
  },
  request: {
    network: '后端接口连接异常',
    timeout: '系统接口请求超时',
    status: '系统接口{code}异常',
    repeat: '数据正在处理，请勿重复提交',
    sessionExpired: '登录状态已过期，您可以继续留在该页面，或者重新登录',
    relogin: '重新登录',
    invalidSession: '无效的会话，或者会话已过期，请重新登录。',
    downloading: '正在下载数据，请稍候',
    downloadFailed: '下载文件出现错误，请联系管理员！',
    http401: '认证失败，无法访问系统资源',
    http403: '当前操作没有权限',
    http404: '访问资源不存在',
    httpDefault: '系统未知错误，请反馈给管理员'
  }
};
