import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { flagList, flagValue, parseArgs } from './args.js';
import { assertPluginId, slugifyId } from './id.js';
import { scaffold } from './scaffold.js';
import { validatePermissions } from './capabilities.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_DIR = resolve(HERE, '..', 'template');

export const USAGE = `用法：
  create-vault-plugin <目录> [选项]

必须：
  --id <id>              插件 id，[a-z0-9-]+，必须等于目录名；省略时由目录名推导

可选：
  --name <名称>          显示名，默认由 id 推导
  --permissions <列表>   逗号分隔；默认 ui:commands
  --allowlist <hosts>    逗号分隔；申请 network:safe 时必填
  --description <文本>
  --author <名字>
  --version <x.y.z>      默认 1.0.0
  --min-app-version <x.y.z>  默认 0.1.0
  -h, --help             显示本帮助

可用权限：
  vault:read  vault:write  ui:commands  ui:ribbon  ui:settings  ui:views
  ui:theme  editor:provide  network:safe

永远不发放：network  publish:*  sync:control  fs:arbitrary  shell

已生成：ui:status  editor:extend  clipboard

示例：
  create-vault-plugin ../my-plugin --name "我的插件"
  create-vault-plugin ../fetch-demo --id fetch-demo \
    --permissions ui:commands,ui:ribbon,network:safe --allowlist api.example.com
`;

function helpRequested(argv) {
  return argv.length === 0 || argv.includes('-h') || argv.includes('--help') || argv.includes('help');
}

export function parseCreateArgs(argv) {
  const { positional, flags } = parseArgs(argv);
  const target = positional[0];
  if (!target) throw new Error('缺少目标目录。create-vault-plugin <目录> --id <id>');

  const dirName = basename(resolve(target));
  const id = flags.id
    ? assertPluginId(flagValue(flags, 'id'))
    : slugifyId(flags.name && typeof flags.name === 'string' ? flags.name : dirName);

  const requested = typeof flags.id === 'string' ? flags.id.trim() : id;
  if (requested !== dirName) {
    throw new Error(
      '目录名「' + dirName + '」与插件 id「' + requested + '」不一致；宿主会静默跳过这个包。' +
        ' 请把目标目录改成 ' + requested + '，或者用 --id ' + dirName,
    );
  }

  const permissions = flagList(flags, 'permissions');
  const effectivePermissions = permissions.length ? permissions : ['ui:commands'];
  const checked = validatePermissions(effectivePermissions);
  if (checked.errors.length) throw new Error(checked.errors.join('\n'));

  const allowlist = flagList(flags, 'allowlist');
  if (effectivePermissions.includes('network:safe') && !allowlist.length) {
    throw new Error('申请 network:safe 必须同时给 --allowlist <host[,host]>');
  }

  return {
    id,
    targetDir: resolve(target),
    options: {
      id,
      name: flagValue(flags, 'name'),
      description: flagValue(flags, 'description'),
      author: flagValue(flags, 'author'),
      version: flagValue(flags, 'version') || '1.0.0',
      minAppVersion: flagValue(flags, 'min-app-version') || '0.1.0',
      permissions: effectivePermissions,
      networkAllowlist: allowlist,
    },
    warnings: checked.warnings,
  };
}

export async function createVaultPluginCli(argv) {
  if (helpRequested(argv)) {
    console.log(USAGE);
    return;
  }
  const { id, targetDir, options, warnings } = parseCreateArgs(argv);
  for (const warning of warnings) console.warn('! ' + warning);

  // Keep the target's own directory name as the authority for the folder.
  const result = await scaffold(TEMPLATE_DIR, targetDir, { ...options, targetDir });
  console.log('已生成插件 ' + result.id + '（' + result.files + ' 个文件）：' + targetDir);
  console.log('');
  console.log('下一步：');
  console.log('  cd ' + targetDir);
  console.log('  npm install');
  console.log('  npm run build');
  console.log('  npm run install:app     # 拷进 <应用配置目录>/extensions/plugins/' + result.id);
  console.log('  然后在「设置 → 插件与安全」里点「启用」。');
  void id;
}
