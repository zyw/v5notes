import common from './packs/zh_CN/common';
import file from './packs/zh_CN/file';
import monitor from './packs/zh_CN/monitor';
import notes from './packs/zh_CN/notes';
import shell from './packs/zh_CN/shell';
import system from './packs/zh_CN/system';
import widgets from './packs/zh_CN/widgets';

export default {
  // 路由国际化
  route: {
    dashboard: '首页',
    document: '项目文档'
  },
  // 登录页面国际化
  login: {
    username: '用户名',
    password: '密码',
    login: '登 录',
    logging: '登 录 中...',
    code: '验证码',
    rememberPassword: '记住我',
    switchRegisterPage: '立即注册',
    welcome: '欢迎回来',
    welcomeSub: '使用管理员账号进入工作台。',
    brandSub: '云笔记 · 管理控制台',
    account: '账号',
    accountPh: '请输入账号',
    passwordPh: '请输入密码',
    codePh: '请输入验证码',
    rememberAccount: '记住账号',
    submit: '登录',
    submitLoading: '登录中…',
    refreshCode: '换一张',
    showPassword: '显示密码',
    hidePassword: '隐藏密码',
    otherWays: '或使用其他方式',
    socialOff: '当前服务器未开启第三方登录',
    langAria: '语言切换',
    socialShort: {
      wechat_open: '微信',
      gitee: 'Gitee',
      github: 'GitHub',
      google: 'Google'
    },
    scene: {
      line1: '把零散的笔记，',
      line2: '收成',
      accent: '一棵树',
      end: '。',
      lede: '目录、Markdown 与权限，让团队的每一条笔记都有归处。',
      treeTitle: '目录树',
      treeDesc: '笔记按目录归位，层级就是上下文。',
      mdTitle: 'Markdown',
      mdDesc: '边写边预览，格式不打断思路。',
      permTitle: '权限',
      permDesc: '目录、笔记、成员，三级可见范围。'
    },
    rule: {
      username: {
        required: '请输入您的账号'
      },
      password: {
        required: '请输入您的密码'
      },
      code: {
        required: '请输入验证码'
      }
    },
    social: {
      wechat_open: '微信登录',
      gitee: 'Gitee登录',
      github: 'GitHub登录',
      google: 'Google登录'
    }
  },
  // 注册页面国际化
  register: {
    username: '用户名',
    password: '密码',
    confirmPassword: '确认密码',
    register: '注 册',
    registering: '注 册 中...',
    registerSuccess: '恭喜你，您的账号 {username} 注册成功！',
    code: '验证码',
    switchLoginPage: '使用已有账户登录',
    rule: {
      username: {
        required: '请输入您的账号',
        length: '用户账号长度必须介于 {min} 和 {max} 之间'
      },
      password: {
        required: '请输入您的密码',
        length: '用户密码长度必须介于 {min} 和 {max} 之间',
        pattern: '不能包含非法字符：{strings}'
      },
      code: {
        required: '请输入验证码'
      },
      confirmPassword: {
        required: '请再次输入您的密码',
        equalToPassword: '两次输入的密码不一致'
      }
    }
  },
  // 导航栏国际化
  navbar: {
    full: '全屏',
    language: '语言',
    dashboard: '首页',
    document: '项目文档',
    message: '消息',
    layoutSize: '布局大小',
    layoutSetting: '布局设置',
    personalCenter: '个人中心',
    logout: '退出登录',
    search: '搜索',
    admin: '管理员',
    logoutConfirm: '确定注销并退出系统吗？'
  },
  ...common,
  ...shell,
  ...notes,
  ...system,
  ...monitor,
  ...file,
  ...widgets
};
