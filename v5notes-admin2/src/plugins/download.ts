import type { LoadingInstance } from 'element-plus';
import axiosModule from 'axios';
import { t } from '@/lang';
import errorCode from '@/utils/errorCode';
import { extractErrorMessage, globalHeaders } from '@/utils/request';
import { blobValidate } from '@/utils/ruoyi';
import { saveBlob } from '@/utils/save';

const axios = axiosModule as any;
const baseURL = import.meta.env.VITE_APP_BASE_API;
let downloadLoadingInstance: LoadingInstance | undefined;
export default {
  async file(fileId: string | number) {
    const url = baseURL + '/basics/admin/file/download/' + fileId;
    downloadLoadingInstance = ElLoading.service({
      text: t('request.downloading'),
      background: 'rgba(0, 0, 0, 0.7)'
    });
    try {
      const res = await axios({
        method: 'get',
        url: url,
        responseType: 'blob',
        headers: globalHeaders()
      });
      const isBlob = blobValidate(res.data);
      if (isBlob) {
        const blob = new Blob([res.data], { type: 'application/octet-stream' });
        saveBlob(blob, decodeURIComponent(res.headers['download-filename'] as string));
      } else {
        this.printErrMsg(res.data);
      }
      downloadLoadingInstance?.close();
    } catch (r) {
      console.error(r);
      const errMsg = await extractErrorMessage(r);
      ElMessage.error(errMsg || t('request.downloadFailed'));
      downloadLoadingInstance?.close();
    }
  },
  async zip(url: string, name: string) {
    url = baseURL + url;
    downloadLoadingInstance = ElLoading.service({
      text: t('request.downloading'),
      background: 'rgba(0, 0, 0, 0.7)'
    });
    try {
      const res = await axios({
        method: 'get',
        url: url,
        responseType: 'blob',
        headers: globalHeaders()
      });
      const isBlob = blobValidate(res.data);
      if (isBlob) {
        const blob = new Blob([res.data], { type: 'application/zip' });
        saveBlob(blob, name);
      } else {
        this.printErrMsg(res.data);
      }
      downloadLoadingInstance?.close();
    } catch (r) {
      console.error(r);
      const errMsg = await extractErrorMessage(r);
      ElMessage.error(errMsg || t('request.downloadFailed'));
      downloadLoadingInstance?.close();
    }
  },
  async printErrMsg(data: any) {
    const resText = await data.text();
    const rspObj = JSON.parse(resText);
    const errMsg = errorCode[rspObj.code] || rspObj.msg || errorCode['default'];
    ElMessage.error(errMsg);
  }
};
