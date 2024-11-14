import compression from 'vite-plugin-compression2';

export default (env: any) => {
  const { VITE_BUILD_COMPRESS } = env;
  const plugin: any[] = [];
  if (VITE_BUILD_COMPRESS) {
    const compressList = VITE_BUILD_COMPRESS.split(',');
    if (compressList.includes('gzip')) {
      // http://doc.ruoyi.vip/ruoyi-vue/other/faq.html#使用gzip解压缩静态文件
      plugin.push(
        compression()
      );
    }
    if (compressList.includes('brotli')) {
      plugin.push(
        compression({
          algorithm: 'brotliCompress'
        })
      );
    }
  }
  return plugin;
};
