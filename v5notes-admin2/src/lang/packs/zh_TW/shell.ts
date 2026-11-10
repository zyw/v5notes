export default {
  layout: {
    logoSub: '雲筆記 · 管理主控台',
    tagsClose: '關閉目前',
    tagsCloseOthers: '關閉其他',
    tagsCloseLeft: '關閉左側',
    tagsCloseRight: '關閉右側',
    tagsCloseAll: '全部關閉',
    tagsFullscreen: '全螢幕顯示',
    tagsExitFullscreen: '退出全螢幕',
    tagsRefresh: '重新整理',
    tagsRefreshPage: '重新整理頁面',
    settingsNav: '選單導覽設定',
    settingsNavLeft: '左側選單',
    settingsNavMix: '混合選單',
    settingsNavTop: '頂部選單',
    settingsTheme: '主題風格設定',
    settingsThemeColor: '主題顏色',
    settingsRadius: '頁面圓角',
    settingsLayout: '系統版面設定',
    settingsTags: '開啟 Tags-Views',
    settingsTagsPersist: '保留標籤頁',
    settingsTagsIcon: '顯示標籤圖示',
    settingsFixedHeader: '固定 Header',
    settingsLogo: '顯示 Logo',
    settingsDynamicTitle: '動態標題',
    settingsFullTable: '全高表格',
    settingsSave: '儲存設定',
    settingsReset: '重設設定',
    settingsSaving: '正在儲存到本機，請稍候...',
    settingsResetting: '正在清除設定快取並重新整理，請稍候...',
    searchPlaceholder: '選單搜尋，支援標題與 URL 模糊查詢',
    searchFound: '找到',
    searchResults: '個結果',
    searchEmpty: '找不到「{keyword}」相關選單',
    searchEmptyTip: '試試其他關鍵字或路徑',
    searchSwitch: '切換',
    searchSelect: '選擇',
    searchClose: '關閉',
    moreMenu: '更多選單'
  },
  notice: {
    title: '訊息匣',
    readAll: '全部已讀',
    system: '系統 {count}',
    notice: '通知 {count}',
    workflow: '工作 {count}',
    message: '訊息',
    read: '已讀',
    unread: '未讀',
    emptyNotice: '暫無通知公告',
    emptyWorkflow: '暫無工作流程訊息',
    emptySystem: '暫無系統訊息'
  },
  errorPage: {
    oops404: '404 錯誤！',
    headline404: '找不到網頁！',
    info404: '您要找的頁面不存在。請檢查網址，或重新整理後從應用程式開啟其他頁面。',
    backHome: '返回首頁',
    oops401: '401 錯誤！',
    headline401: '您沒有存取權限！',
    info401: '您沒有存取權限，請不要進行未授權的操作。您可以返回主頁。',
    back: '返回',
    goHome: '回首頁'
  },
  error: {
    retry: '重新載入',
    timeout: {
      title: '請求逾時',
      message: '服務沒有在預期時間內回應，可能是網路較慢或服務忙碌，請重試。'
    },
    network: {
      title: '網路連線異常',
      message: '無法連到筆記服務，請檢查網路或後端是否可用後重試。'
    },
    session: {
      title: '工作階段已過期',
      message: '登入狀態已失效，請重新登入後繼續。'
    },
    server: {
      title: '服務暫時無法使用',
      message: '服務端回傳錯誤，請稍後重試。',
      messageWithCode: '服務端回傳錯誤（{code}），請稍後重試。'
    },
    unknown: {
      title: '載入失敗',
      message: '發生未知錯誤，請重試。'
    }
  },
  request: {
    network: '後端介面連線異常',
    timeout: '系統介面請求逾時',
    status: '系統介面 {code} 異常',
    repeat: '資料正在處理，請勿重複提交',
    sessionExpired: '登入狀態已過期，您可以留在此頁，或重新登入',
    relogin: '重新登入',
    invalidSession: '無效的工作階段，或工作階段已過期，請重新登入。',
    downloading: '正在下載資料，請稍候',
    downloadFailed: '下載檔案時發生錯誤，請聯絡管理員！',
    http401: '認證失敗，無法存取系統資源',
    http403: '目前操作沒有權限',
    http404: '存取的資源不存在',
    httpDefault: '系統發生未知錯誤，請回報給管理員'
  }
};
