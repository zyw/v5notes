#!/usr/bin/env python3
"""根据已上传的 Tauri 更新包和 .sig 生成 V5Notes Vault 的 vault-latest.json。

清单字段是 Tauri 2 更新插件的静态格式。signature 取自构建时生成的 .sig 全文，
本脚本不接触更新私钥。下载地址使用 GitHub Release 的不可变直链。

清单文件名固定为 vault-latest.json：Cloud（v5notes-client2）用 latest.json，
两者可以挂在同一个 Release 里互不覆盖，客户端各取各的地址。
默认只要求 macOS Apple 芯片；其余平台用 --require 追加（例如
--require darwin-aarch64,windows-x86_64）。缺签名包直接失败，避免清单换掉
另一个系统的更新入口。

用法：
  python3 scripts/vault_latest_json.py \
    --assets-dir dist --version 2.2.0 --tag vault-v2.2.0 \
    --repo zyw/v5notes --notes-file releases/2.2.0.md \
    --pub-date 2026-11-19T00:00:00Z --out dist/vault-latest.json
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Optional
from urllib.parse import quote


UPDATER_SUFFIXES = (".app.tar.gz", ".nsis.zip", ".appimage.tar.gz")
DEFAULT_REQUIRED = ("darwin-aarch64",)
MANIFEST_NAME = "vault-latest.json"


def platform_for(name: str) -> Optional[str]:
    lower = name.lower()
    if lower.endswith(".sig"):
        return None
    if lower.endswith(".app.tar.gz"):
        os_name = "darwin"
    elif lower.endswith(".nsis.zip"):
        os_name = "windows"
    elif lower.endswith(".appimage.tar.gz"):
        os_name = "linux"
    else:
        return None

    if "aarch64" in lower or "arm64" in lower:
        arch = "aarch64"
    elif "x86_64" in lower or "amd64" in lower or "x64" in lower:
        arch = "x86_64"
    else:
        raise SystemExit(
            f"无法判断 {name} 的架构。文件名需要包含 aarch64、arm64、x64、x86_64 或 amd64。\n"
            "macOS 的 Tauri 更新包默认叫 “V5Notes Vault.app.tar.gz”，上传前请改名为 "
            "vault_aarch64.app.tar.gz 或 vault_x64.app.tar.gz，并把对应的 .sig 一起改名。"
        )
    return f"{os_name}-{arch}"


def artifact_names(directory: Path) -> list[str]:
    names = []
    for path in sorted(directory.iterdir()):
        if not path.is_file() or path.name.lower().endswith(".sig"):
            continue
        if any(path.name.lower().endswith(suffix) for suffix in UPDATER_SUFFIXES):
            names.append(path.name)
    return names


def build_manifest(
    directory: Path,
    version: str,
    tag: str,
    repo: str,
    notes: str,
    pub_date: str,
    required: tuple[str, ...],
) -> dict:
    platforms: dict[str, dict[str, str]] = {}
    for name in artifact_names(directory):
        platform = platform_for(name)
        if platform is None:
            continue
        signature_path = directory / f"{name}.sig"
        if not signature_path.is_file():
            raise SystemExit(f"缺少签名文件 {name}.sig，不能生成会指向未签名包的清单。")
        signature = signature_path.read_text(encoding="utf-8").strip()
        if not signature:
            raise SystemExit(f"{name}.sig 是空的。")
        if platform in platforms:
            raise SystemExit(
                f"有两个更新包都对应 {platform}。每个平台只保留一个更新包后再生成清单。"
            )
        platforms[platform] = {
            "signature": signature,
            "url": f"https://github.com/{repo}/releases/download/{quote(tag)}/{quote(name)}",
        }

    missing = [name for name in required if name not in platforms]
    if missing:
        raise SystemExit(
            "清单缺少要求的平台：" + "、".join(missing) + "。\n"
            "需要 vault_aarch64.app.tar.gz（以及 --require 追加平台的包）和各自的 .sig。"
        )
    if not platforms:
        raise SystemExit("附件目录里没有可用的更新包。")

    return {
        "version": version,
        "notes": notes,
        "pub_date": pub_date,
        "platforms": dict(sorted(platforms.items())),
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=f"生成 V5Notes Vault 的 Tauri 更新清单 {MANIFEST_NAME}")
    parser.add_argument("--assets-dir", required=True, type=Path)
    parser.add_argument("--version", required=True, help="不带 v 的语义化版本，如 2.2.0")
    parser.add_argument("--tag", required=True, help="Release tag，如 vault-v2.2.0")
    parser.add_argument("--repo", required=True, help="owner/name，如 zyw/v5notes")
    parser.add_argument("--notes-file", type=Path)
    parser.add_argument("--pub-date", required=True, help="RFC3339 UTC 时间")
    parser.add_argument(
        "--require",
        default=",".join(DEFAULT_REQUIRED),
        help="必须包含的平台，逗号分隔；默认 darwin-aarch64",
    )
    parser.add_argument("--out", required=True, type=Path)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.out.name != MANIFEST_NAME:
        raise SystemExit(
            f"清单必须写成 {MANIFEST_NAME}（当前 {args.out.name}）："
            "这是客户端固定的文件名，写成 latest.json 会盖掉 Cloud 的清单。"
        )
    if not args.assets_dir.is_dir():
        raise SystemExit(f"附件目录不存在：{args.assets_dir}")
    notes = ""
    if args.notes_file is not None:
        if not args.notes_file.is_file():
            raise SystemExit(f"找不到更新说明：{args.notes_file}")
        notes = args.notes_file.read_text(encoding="utf-8").strip()
    required = tuple(item.strip() for item in args.require.split(",") if item.strip())
    manifest = build_manifest(
        args.assets_dir,
        args.version,
        args.tag,
        args.repo,
        notes,
        args.pub_date,
        required,
    )
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"已生成 {args.out}，平台：{', '.join(manifest['platforms'])}")


if __name__ == "__main__":
    try:
        main()
    except BrokenPipeError:
        sys.exit(0)
