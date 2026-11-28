-- P3：Vault 官方扩展与主题目录表（PostgreSQL 方言）

CREATE TABLE IF NOT EXISTS vault_catalog_item
(
    id               varchar(64)  NOT NULL,
    name             varchar(100) NOT NULL,
    kind             varchar(16)  NOT NULL,
    version          varchar(32)  NOT NULL,
    min_app_version  varchar(32)           DEFAULT '0.1.0',
    description      varchar(500)          DEFAULT NULL,
    author           varchar(100)          DEFAULT NULL,
    author_url       varchar(255)          DEFAULT NULL,
    permissions_json text         NOT NULL,
    allowlist_json   text                  DEFAULT NULL,
    tags_json        text                  DEFAULT NULL,
    files_json       text         NOT NULL,
    status           char(1)      NOT NULL DEFAULT '0',
    sort_order       integer      NOT NULL DEFAULT 0,
    create_by        bigint                DEFAULT NULL,
    create_time      timestamp             DEFAULT CURRENT_TIMESTAMP,
    update_by        bigint                DEFAULT NULL,
    update_time      timestamp             DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_vault_catalog_kind_status ON vault_catalog_item (kind, status, sort_order);

COMMENT ON TABLE vault_catalog_item IS 'Vault 官方扩展与主题目录';
COMMENT ON COLUMN vault_catalog_item.id IS '扩展稳定 ID（[a-z0-9-]+）';
COMMENT ON COLUMN vault_catalog_item.kind IS 'plugin / theme';
COMMENT ON COLUMN vault_catalog_item.status IS '0草稿 1已上架 2已下架';

INSERT INTO vault_catalog_item (
    id, name, kind, version, min_app_version, description, author, author_url,
    permissions_json, allowlist_json, tags_json, files_json, status, sort_order, create_time
)
SELECT
    'safe-fetch-demo',
    'Safe Fetch Demo',
    'plugin',
    '1.0.0',
    '0.1.0',
    '官方示例：network:safe 白名单 GET + Ribbon/SettingTab',
    'v5notes',
    NULL,
    '["ui:commands","ui:ribbon","ui:settings","network:safe"]',
    '["httpbin.org"]',
    '["demo","network","official"]',
    $$ {"manifest.json":"{\n  \"id\": \"safe-fetch-demo\",\n  \"name\": \"Safe Fetch Demo\",\n  \"kind\": \"plugin\",\n  \"version\": \"1.0.0\",\n  \"minAppVersion\": \"0.1.0\",\n  \"description\": \"官方示例：network:safe 白名单 GET + Ribbon/SettingTab\",\n  \"author\": \"v5notes\",\n  \"permissions\": [\"ui:commands\", \"ui:ribbon\", \"ui:settings\", \"network:safe\"],\n  \"networkAllowlist\": [\"httpbin.org\"],\n  \"tags\": [\"demo\", \"network\", \"official\"],\n  \"main\": \"main.js\"\n}","main.js":"module.exports = class SafeFetchDemoPlugin extends Plugin {\n  async onload() {\n    this.addCommand({\n      id: 'ping-httpbin',\n      name: 'Ping httpbin (network:safe)',\n      callback: async () => {\n        try {\n          const res = await this.app.network.request('https://httpbin.org/get?from=v5notes-vault')\n          this.app.workspace.openNotice('httpbin OK · status ' + res.status)\n        } catch (e) {\n          this.app.workspace.openNotice('network:safe 失败: ' + (e && e.message ? e.message : String(e)))\n        }\n      },\n    })\n    this.addRibbonIcon({\n      id: 'safe-fetch-ribbon',\n      title: 'Safe Fetch',\n      icon: 'SF',\n      callback: async () => {\n        this.app.workspace.openNotice('Ribbon → 使用命令「Ping httpbin」')\n      },\n    })\n    this.addSettingTab({\n      id: 'safe-fetch-settings',\n      name: 'Safe Fetch',\n      display: (el) => {\n        el.innerHTML = ''\n        const p = document.createElement('p')\n        p.textContent = '仅允许访问 httpbin.org。无第三方发布。'\n        el.appendChild(p)\n      },\n    })\n  }\n}"} $$,
    '1',
    10,
    CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM vault_catalog_item WHERE id = 'safe-fetch-demo');

INSERT INTO vault_catalog_item (
    id, name, kind, version, min_app_version, description, author, author_url,
    permissions_json, allowlist_json, tags_json, files_json, status, sort_order, create_time
)
SELECT
    'catalog-moss',
    'Catalog Moss',
    'theme',
    '1.0.0',
    '0.1.0',
    '官方 catalog 示例主题（柔和苔绿）',
    'v5notes',
    NULL,
    '["ui:theme"]',
    '[]',
    '["demo","theme","official"]',
    $$ {"manifest.json":"{\n  \"id\": \"catalog-moss\",\n  \"name\": \"Catalog Moss\",\n  \"kind\": \"theme\",\n  \"version\": \"1.0.0\",\n  \"minAppVersion\": \"0.1.0\",\n  \"description\": \"官方 catalog 示例主题（柔和苔绿）\",\n  \"author\": \"v5notes\",\n  \"permissions\": [\"ui:theme\"],\n  \"tags\": [\"demo\", \"theme\", \"official\"],\n  \"theme\": \"theme.css\"\n}","theme.css":":root[data-community-theme='catalog-moss'] {\n  --bg: #f3f6f1;\n  --panel: #fbfdfa;\n  --ink: #1e2a22;\n  --muted: #5c6b60;\n  --line: #d5e0d6;\n  --accent: #3d6b4f;\n  --accent-hover: #31573f;\n  --surface: #e9efe9;\n  --danger: #8a3b2e;\n  --danger-bg: #f3e4e0;\n}\n\n:root[data-community-theme='catalog-moss'][data-color-mode='dark'] {\n  --bg: #141b16;\n  --panel: #1c2620;\n  --ink: #e3ece5;\n  --muted: #93a496;\n  --line: #2e3b32;\n  --accent: #7cb08c;\n  --accent-hover: #97c5a5;\n  --surface: #232e26;\n  --danger: #e0a090;\n  --danger-bg: #3a2a26;\n}\n\n:root[data-community-theme='catalog-moss'][data-color-preference='dark']:not([data-color-mode='dark']) {\n  --bg: #141b16;\n  --panel: #1c2620;\n  --ink: #e3ece5;\n  --muted: #93a496;\n  --line: #2e3b32;\n  --accent: #7cb08c;\n  --accent-hover: #97c5a5;\n  --surface: #232e26;\n  --danger: #e0a090;\n  --danger-bg: #3a2a26;\n}"} $$,
    '1',
    20,
    CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM vault_catalog_item WHERE id = 'catalog-moss');
