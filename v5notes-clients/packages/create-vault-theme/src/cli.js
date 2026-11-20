import { basename, join, resolve } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { mkdir, writeFile } from 'node:fs/promises';
import { isDirectoryEmpty, pathExists } from './fsutil.js';
import { buildThemePackage, renderTemplate } from './render.js';
import { resolveAccent } from './colors.js';
import { validateThemeCss, stripCssComments } from './validate.js';
import { RESERVED_THEME_IDS, THEME_ID_RE, validateThemeManifest } from './manifest.js';
import { slugifyId } from './ids.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_DIR = join(HERE, '..', 'template');
const TEMPLATE_CSS = join(TEMPLATE_DIR, 'theme.css');

export const USAGE = `用法：
  create-vault-theme <目录> [选项]

必须：
  --id <id>            主题 id，[a-z0-9-]+，必须等于目录名；省略时由目录名推导

可选：
  --name <名称>        显示名，默认由 id 推导
  --accent <颜色>      预设名或 #rgb/#rrggbb；预设：moss indigo brick plum amber slate
                       省略时按 id 稳定挑一个
  --mode <warm|cool>   底色：warm 暖纸（默认）/ cool 冷灰
  --description <文本>
  --version <x.y.z>    默认 1.0.0
  -h, --help           显示本帮助

内置主题 id 不可用：default、dusk

示例：
  create-vault-theme ../my-theme --name "我的主题"
  create-vault-theme ../ink-night --accent indigo --mode cool
`;

function helpRequested(argv) {
  return argv.length === 0 || argv.includes('-h') || argv.includes('--help') || argv.includes('help');
}

function parseFlags(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      positional.push(arg);
      continue;
    }
    const body = arg.slice(2);
    const eq = body.indexOf('=');
    if (eq !== -1) {
      flags[body.slice(0, eq)] = body.slice(eq + 1);
      continue;
    }
    const next = argv[i + 1];
    if (next == null || next.startsWith('--')) {
      flags[body] = true;
      continue;
    }
    flags[body] = next;
    i++;
  }
  return { positional, flags };
}

/** Accepts a loose value ("ink-night") but must end at the host's regex. */
export function resolveThemeId(dirName, rawId, rawName) {
  if (rawId && typeof rawId === 'string') {
    const id = rawId.trim();
    if (!THEME_ID_RE.test(id)) throw new Error('主题 id「' + id + '」不合法：只允许 a-z、0-9、-');
    if (id !== dirName) {
      throw new Error(
        '目录名「' + dirName + '」与主题 id「' + id + '」不一致；宿主会静默跳过这个包。' +
          ' 请把目标目录改成 ' + id + '，或者用 --id ' + dirName,
      );
    }
    if (RESERVED_THEME_IDS.includes(id)) throw new Error('「' + id + '」是内置主题 id');
    return id;
  }
  const id = slugifyId(dirName);
  if (RESERVED_THEME_IDS.includes(id)) throw new Error('「' + id + '」是内置主题 id');
  void rawName;
  return id;
}

export function parseThemeArgs(argv) {
  const { positional, flags } = parseFlags(argv);
  const target = positional[0];
  if (!target) throw new Error('缺少目标目录。create-vault-theme <目录> --name <名称>');

  const absoluteTarget = resolve(target);
  const dirName = basename(absoluteTarget);
  const id = resolveThemeId(
    dirName,
    typeof flags.id === 'string' ? flags.id : undefined,
    typeof flags.name === 'string' ? flags.name : undefined,
  );

  const mode = flags.mode == null ? 'warm' : String(flags.mode);
  if (mode !== 'warm' && mode !== 'cool') throw new Error('--mode 只能是 warm 或 cool');

  const options = {
    id,
    targetDir: absoluteTarget,
    name: typeof flags.name === 'string' ? flags.name : undefined,
    description: typeof flags.description === 'string' ? flags.description : undefined,
    version: typeof flags.version === 'string' ? flags.version : '1.0.0',
    accent: typeof flags.accent === 'string' ? flags.accent : undefined,
    warm: mode === 'warm',
  };
  // Fail on a bad accent before touching the filesystem.
  resolveAccent(options.accent, options.id);
  return { id, targetDir: absoluteTarget, options };
}

/**
 * Write a complete theme package to `target` and validate the CSS it
 * produced. Refuses non-empty targets, same as the plugin scaffold.
 */
export async function createThemePackage(targetDir, options) {
  if (await pathExists(targetDir)) {
    if (!(await isDirectoryEmpty(targetDir))) {
      throw new Error('目标目录不是空目录：' + targetDir);
    }
  }
  const read = (path) => readFile(path, 'utf8');
  const built = buildThemePackage(options, {
    templateCss: await read(TEMPLATE_CSS),
    buildScript: await read(join(TEMPLATE_DIR, 'scripts', 'build.mjs')),
    installScript: await read(join(TEMPLATE_DIR, 'scripts', 'install.mjs')),
  });

  // The manifest the generator just built must pass the same check the host does.
  const manifest = JSON.parse(built.files['manifest.json']);
  const manifestCheck = validateThemeManifest(manifest);
  if (manifestCheck.errors.length) throw new Error(manifestCheck.errors.join('\n'));

  const cssCheck = validateThemeCss(stripCssComments(built.files['theme.css']), { id: options.id });
  if (!cssCheck.ok) throw new Error('生成的 theme.css 未通过校验：\n' + cssCheck.errors.join('\n'));

  await mkdir(targetDir, { recursive: true });
  const files = Object.entries(built.files);
  for (const [name, text] of files) {
    const full = join(targetDir, name);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, text.endsWith('\n') ? text : text + '\n', 'utf8');
  }
  return { id: options.id, accent: built.accent, warnings: cssCheck.warnings, count: files.length };
}

export async function createVaultThemeCli(argv) {
  if (helpRequested(argv)) {
    console.log(USAGE);
    return;
  }
  const { targetDir, options } = parseThemeArgs(argv);
  const result = await createThemePackage(targetDir, options);
  for (const warning of result.warnings) console.warn('! ' + warning);
  console.log('已生成主题 ' + result.id + '（' + result.count + ' 个文件，主色 ' + result.accent + '）：' + targetDir);
  console.log('');
  console.log('下一步：');
  console.log('  cd ' + targetDir);
  console.log('  npm run check           # 只校验，不写文件');
  console.log('  npm run build           # 校验并输出到 dist/');
  console.log('  npm run install:app     # 拷进 <应用配置目录>/extensions/themes/' + result.id);
  console.log('  然后在「设置 → 外观」里选择它。');
}
