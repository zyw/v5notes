import { join, relative } from 'node:path';
import { applyConditionals, renderTemplate, surfaceFlags, templateValues } from './render.js';
import { buildManifest } from './manifest.js';
import { assertPluginId } from './id.js';
import { ensureDir, isDirectoryEmpty, pathExists, walkFiles, writeJson, writeText } from './files.js';

/**
 * Copy the template folder into `targetDir`, rendering {{TOKEN}}s and dropping
 * optional surfaces. Refuses to write into a non-empty directory.
 *
 * @param {string} templateDir
 * @param {string} targetDir
 * @param {object} options  { id, name, permissions, version, author, description, allowlist }
 */
export async function scaffold(templateDir, targetDir, options) {
  const id = assertPluginId(options.id);
  const absoluteTarget = options.targetDir;
  if (await pathExists(absoluteTarget)) {
    if (!(await isDirectoryEmpty(absoluteTarget))) {
      throw new Error('目标目录不是空目录：' + absoluteTarget);
    }
  }
  await ensureDir(absoluteTarget);

  const values = templateValues({ ...options, id });
  const flags = surfaceFlags({ ...options, id });
  const files = await walkFiles(templateDir);

  for (const rel of files) {
    const source = await (await import('node:fs/promises')).readFile(join(templateDir, rel), 'utf8');
    const outPath = join(absoluteTarget, rel);
    // package.json.template -> package.json
    const finalPath = outPath.endsWith('.template') ? outPath.slice(0, -'.template'.length) : outPath;

    if (rel.endsWith('manifest.json')) {
      await writeJson(finalPath, buildManifest({ ...options, id }));
      continue;
    }
    const rendered = renderTemplate(applyConditionals(source, flags), values);
    if (finalPath.endsWith('package-lock.json')) {
      await writeText(finalPath, rendered.replace(/\n$/, ''));
    } else {
      await writeText(finalPath, rendered);
    }
  }

  return { id, dir: absoluteTarget, files: files.length };
}

export function reportCreated(id, dir, files) {
  return ['已生成插件 ' + id + '（' + files + ' 个文件）', '  目录：' + relative(process.cwd(), dir) || dir].join('\n');
}
