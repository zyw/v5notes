import useGlobalStore from "@/stores/modules/global";
// 工具类提示信息
type MessageType = "info" | "success" | "error" | "warning";

const layoutDrag = (dragId) => {
    const resize = document.getElementById(dragId);
    let previousElement = resize.previousSibling;
    let nextElement = resize.nextSibling;
    //@ts-ignore
    let previousTag = previousElement.tagName;
    //@ts-ignore
    let nextTag = nextElement.tagName;

    resize.onmousedown = e => {
        const startX = e.clientX;
        const startY = e.clientY;
        let type = '';
        if (previousTag === 'ASIDE' && nextTag === 'MAIN') {
            type = 'ASIDE-MAIN'
        } else if (previousTag === 'MAIN' && nextTag === 'ASIDE') {
            type = 'MAIN-ASIDE'
        } else if ((previousTag === 'HEADER' && nextTag === 'MAIN') || (previousTag === 'FOOTER' && nextTag === 'MAIN')) {
            type = 'HEADER-MAIN'
        } else if ((previousTag === 'MAIN' && nextTag === 'HEADER') || (previousTag === 'MAIN' && nextTag === 'FOOTER')) {
            type = 'MAIN-HEADER'
        }

        
        let initWidth = 0, initHeight = 0;
        if (type === 'ASIDE-MAIN') {
            //@ts-ignore
            initWidth = previousElement.clientWidth; // 初始位置 
        } else if (type === 'MAIN-ASIDE') {
            //@ts-ignore
            initWidth = nextElement.clientWidth; // 初始位置 
        } else if (type === 'HEADER-MAIN') {
            //@ts-ignore
            initHeight = previousElement.clientHeight;
        } else if(type === 'MAIN-HEADER') {
            //@ts-ignore
            initHeight = nextElement.clientHeight;
        }
        
        document.onmousemove = k => {
            const endX = k.clientX;
            const endY = k.clientY;
            let moveLen = endX - startX; // 横向移动宽度
            let moveHeight = endY -startY; // 纵向移动高度
            switch (type) {
            case 'ASIDE-MAIN':
                let asideMainWidth = initWidth + moveLen
                if (moveLen < 0) { // 向左移
                if (asideMainWidth > 260) { // 左侧剩90
                    //@ts-ignore
                    previousElement.style.width =  asideMainWidth + 'px'
                }
                } else { // 向右移动
                    //@ts-ignore
                if (nextElement.clientWidth > 600) { // 右侧剩90
                    //@ts-ignore
                    previousElement.style.width =  asideMainWidth + 'px'
                }
                
                }
                break;
            case 'MAIN-ASIDE': 
                let mainAsideWidth = initWidth - moveLen;
                if (moveLen < 0) { // 向左移
                    //@ts-ignore
                if (previousElement.clientWidth > 260) { // 左侧剩90
                    //@ts-ignore
                    nextElement.style.width =  mainAsideWidth + 'px'
                }
                } else { // 向右移动
                if (mainAsideWidth > 600) {
                    //@ts-ignore
                    nextElement.style.width =  mainAsideWidth + 'px'
                }
                }
                break;
            case 'HEADER-MAIN': {
                let headerMainHeight = initHeight + moveHeight
                if (moveHeight < 0) { // 向上移
                if (headerMainHeight > 60) { // 上侧剩90
                    //@ts-ignore
                    previousElement.style.height =  headerMainHeight + 'px'
                }
                } else { // 向下移动
                    //@ts-ignore
                if (nextElement.clientHeight > 60) { // 下侧剩90
                    //@ts-ignore
                    previousElement.style.height =  headerMainHeight + 'px'
                }
                
                }
                break;
            }
            case 'MAIN-HEADER': {
                let mainHeaderHeight = initHeight - moveHeight;
                if (moveHeight < 0) { // 向上移
                    //@ts-ignore
                if (previousElement.clientHeight > 60) { // 左侧剩90
                    //@ts-ignore
                    nextElement.style.height =  mainHeaderHeight + 'px'
                }
                } else { // 向下移动
                if (mainHeaderHeight > 60) {
                    //@ts-ignore
                    nextElement.style.height =  mainHeaderHeight + 'px'
                }
                }
                break;
            }
            
            default:
                
            }

        }
        document.onmouseup = evt => {
            document.onmousemove = null;
            document.onmouseup = null;
            //@ts-ignore
            resize.releaseCapture && resize.releaseCapture();
            
            
        }
        //@ts-ignore
        resize.setCapture && resize.setCapture();
        return false;
        }
}

/**
 * @description 获取assets静态资源
 * @param url
 */
const getAssets = (url: string) => {
    return new URL(`../assets/${url}`, import.meta.url).href;
};

/** 封装提示信息，默认warning */
const koiMsgWarning = (message: any, duration = 2000, type: MessageType = "warning", parseHtml = false) => {
    ElMessage.closeAll();
    ElMessage({
      message,
      type,
      duration: duration,
      showClose: true,
      dangerouslyUseHTMLString: parseHtml
    });
}

/** 封装提示信息，默认error */
const koiMsgError = (message: any, duration = 2000, type: MessageType = "error", parseHtml = false) => {
    ElMessage.closeAll();
    ElMessage({
      message,
      type,
      duration: duration,
      showClose: true,
      dangerouslyUseHTMLString: parseHtml
    });
}


/**
 * 参数处理
 * @param {*} params  参数
 */
const tansParams = (params: any) => {
    let result = '';
    for (const propName of Object.keys(params)) {
      const value = params[propName];
      const part = encodeURIComponent(propName) + '=';
      if (value !== null && value !== '' && typeof value !== 'undefined') {
        if (typeof value === 'object') {
          for (const key of Object.keys(value)) {
            if (value[key] !== null && value[key] !== '' && typeof value[key] !== 'undefined') {
              const params = propName + '[' + key + ']';
              const subPart = encodeURIComponent(params) + '=';
              result += subPart + encodeURIComponent(value[key]) + '&';
            }
          }
        } else {
          result += part + encodeURIComponent(value) + '&';
        }
      }
    }
    return result;
};

const getServerUrl = ():string => {
    let globalStore = null;
    if(!globalStore) {
        globalStore = useGlobalStore();
    }
    return globalStore.serverUrl;
}

/**
 * @description 生成唯一 uuid
 * @returns {String}
 */
const generateUUID = () => {
    let uuid = "";
    for (let i = 0; i < 32; i++) {
        let random = (Math.random() * 16) | 0;
        if (i === 8 || i === 12 || i === 16 || i === 20) uuid += "-";
        uuid += (i === 12 ? 4 : i === 16 ? (random & 3) | 8 : random).toString(16);
    }
    return uuid;
}

export { layoutDrag, getAssets, koiMsgWarning, koiMsgError, tansParams, getServerUrl, generateUUID }