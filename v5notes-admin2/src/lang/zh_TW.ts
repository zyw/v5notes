import common from './packs/zh_TW/common';
import dict from './packs/zh_TW/dict';
import file from './packs/zh_TW/file';
import menu from './packs/zh_TW/menu';
import monitor from './packs/zh_TW/monitor';
import notes from './packs/zh_TW/notes';
import shell from './packs/zh_TW/shell';
import system from './packs/zh_TW/system';
import widgets from './packs/zh_TW/widgets';

export default {
  route: {
    dashboard: '首頁',
    document: '專案文件'
  },
  login: {
    username: '使用者名稱',
    password: '密碼',
    login: '登入',
    logging: '登入中...',
    code: '驗證碼',
    rememberPassword: '記住我',
    switchRegisterPage: '立即註冊',
    welcome: '歡迎回來',
    welcomeSub: '使用管理員帳號進入工作台。',
    brandSub: '雲筆記 · 管理主控台',
    account: '帳號',
    accountPh: '請輸入帳號',
    passwordPh: '請輸入密碼',
    codePh: '請輸入驗證碼',
    rememberAccount: '記住帳號',
    submit: '登入',
    submitLoading: '登入中…',
    refreshCode: '換一張',
    showPassword: '顯示密碼',
    hidePassword: '隱藏密碼',
    otherWays: '或使用其他方式',
    langAria: '語言切換',
    socialShort: {
      wechat: '微信',
      maxkey: 'MaxKey',
      topiam: 'TopIAM',
      gitee: 'Gitee',
      github: 'GitHub'
    },
    scene: {
      line1: '把零散的筆記，',
      line2: '收成',
      accent: '一棵樹',
      end: '。',
      lede: '目錄、Markdown 與權限，讓團隊的每一則筆記都有歸處。',
      treeTitle: '目錄樹',
      treeDesc: '筆記按目錄歸位，層級就是上下文。',
      mdTitle: 'Markdown',
      mdDesc: '邊寫邊預覽，格式不打斷思路。',
      permTitle: '權限',
      permDesc: '目錄、筆記、成員，三級可見範圍。'
    },
    rule: {
      username: {
        required: '請輸入您的帳號'
      },
      password: {
        required: '請輸入您的密碼'
      },
      code: {
        required: '請輸入驗證碼'
      }
    },
    social: {
      wechat: '微信登入',
      maxkey: 'MaxKey登入',
      topiam: 'TopIam登入',
      gitee: 'Gitee登入',
      github: 'Github登入'
    }
  },
  register: {
    username: '使用者名稱',
    password: '密碼',
    confirmPassword: '確認密碼',
    register: '註冊',
    registering: '註冊中...',
    registerSuccess: '恭喜你，您的帳號 {username} 註冊成功！',
    code: '驗證碼',
    switchLoginPage: '使用已有帳戶登入',
    rule: {
      username: {
        required: '請輸入您的帳號',
        length: '使用者帳號長度必須介於 {min} 和 {max} 之間'
      },
      password: {
        required: '請輸入您的密碼',
        length: '使用者密碼長度必須介於 {min} 和 {max} 之間',
        pattern: '不能包含非法字元：{strings}'
      },
      code: {
        required: '請輸入驗證碼'
      },
      confirmPassword: {
        required: '請再次輸入您的密碼',
        equalToPassword: '兩次輸入的密碼不一致'
      }
    }
  },
  navbar: {
    full: '全螢幕',
    language: '語言',
    dashboard: '首頁',
    document: '專案文件',
    message: '訊息',
    layoutSize: '版面大小',
    layoutSetting: '版面設定',
    personalCenter: '個人中心',
    logout: '登出',
    search: '搜尋',
    admin: '管理員',
    logoutConfirm: '確定登出並離開系統嗎？'
  },
  ...common,
  ...shell,
  ...menu,
  ...dict,
  ...notes,
  ...system,
  ...monitor,
  ...file,
  ...widgets
};
