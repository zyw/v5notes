import vue from '@vitejs/plugin-vue';
import createUnoCss from './unocss';
import createAutoImport from './auto-import';
import createComponents from './components';
import createCompression from './compression';
import createIcons from './icons';
import path from 'path';

export default (viteEnv: any, isBuild = false): [] => {
  const vitePlugins: any = [];
  vitePlugins.push(vue());
  vitePlugins.push(createUnoCss());
  vitePlugins.push(createAutoImport(path));
  vitePlugins.push(createComponents(path));
  vitePlugins.push(createCompression(viteEnv));
  vitePlugins.push(createIcons());
  return vitePlugins;
};
