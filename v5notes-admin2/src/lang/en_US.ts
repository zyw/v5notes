import common from './packs/en_US/common';
import dict from './packs/en_US/dict';
import file from './packs/en_US/file';
import menu from './packs/en_US/menu';
import monitor from './packs/en_US/monitor';
import notes from './packs/en_US/notes';
import shell from './packs/en_US/shell';
import system from './packs/en_US/system';
import widgets from './packs/en_US/widgets';

export default {
  // 路由国际化
  route: {
    dashboard: 'Dashboard',
    document: 'Document'
  },
  // 登录页面国际化
  login: {
    username: 'Username',
    password: 'Password',
    login: 'Login',
    logging: 'Logging...',
    code: 'Verification Code',
    rememberPassword: 'Remember me',
    switchRegisterPage: 'Sign up now',
    welcome: 'Welcome back',
    welcomeSub: 'Sign in with your administrator account.',
    brandSub: 'Cloud notes · Admin console',
    account: 'Account',
    accountPh: 'Enter your account',
    passwordPh: 'Enter your password',
    codePh: 'Enter the code',
    rememberAccount: 'Remember me',
    submit: 'Sign in',
    submitLoading: 'Signing in…',
    refreshCode: 'New code',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
    otherWays: 'Or continue with',
    langAria: 'Language',
    socialShort: {
      wechat: 'WeChat',
      maxkey: 'MaxKey',
      topiam: 'TopIAM',
      gitee: 'Gitee',
      github: 'GitHub'
    },
    scene: {
      line1: 'Scattered notes,',
      line2: 'grown into ',
      accent: 'one tree',
      end: '.',
      lede: 'Folders, Markdown and permissions — every note has its place.',
      treeTitle: 'Folders',
      treeDesc: 'Notes live in their folders; hierarchy is context.',
      mdTitle: 'Markdown',
      mdDesc: 'Write and preview side by side.',
      permTitle: 'Permissions',
      permDesc: 'Folder, note and member level access.'
    },
    rule: {
      username: {
        required: 'Please enter your account'
      },
      password: {
        required: 'Please enter your password'
      },
      code: {
        required: 'Please enter a verification code'
      }
    },
    social: {
      wechat: 'Wechat Login',
      maxkey: 'MaxKey Login',
      topiam: 'TopIam Login',
      gitee: 'Gitee Login',
      github: 'Github Login'
    }
  },
  // 注册页面国际化
  register: {
    username: 'Username',
    password: 'Password',
    confirmPassword: 'Confirm Password',
    register: 'Register',
    registering: 'Registering...',
    registerSuccess: 'Congratulations, your {username} account has been registered!',
    code: 'Verification Code',
    switchLoginPage: 'Log in with an existing account',
    rule: {
      username: {
        required: 'Please enter your account',
        length: 'The length of the user account must be between {min} and {max}'
      },
      password: {
        required: 'Please enter your password',
        length: 'The user password must be between {min} and {max} in length',
        pattern: "Can't contain illegal characters: {strings}"
      },
      code: {
        required: 'Please enter a verification code'
      },
      confirmPassword: {
        required: 'Please enter your password again',
        equalToPassword: 'The password entered twice is inconsistent'
      }
    }
  },
  // 导航栏国际化
  navbar: {
    full: 'Full Screen',
    language: 'Language',
    dashboard: 'Dashboard',
    document: 'Document',
    message: 'Message',
    layoutSize: 'Layout Size',
    layoutSetting: 'Layout Setting',
    personalCenter: 'Profile',
    logout: 'Log out',
    search: 'Search',
    admin: 'Administrator',
    logoutConfirm: 'Log out and leave the console?'
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
