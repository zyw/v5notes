package xin.v5ai.vault.service;

import org.springframework.stereotype.Service;
import xin.v5ai.vault.catalog.CatalogProtocol;
import xin.v5ai.vault.domain.vo.VaultCatalogItemVo;
import xin.v5ai.vault.domain.vo.VaultCatalogListVo;
import xin.v5ai.vault.domain.vo.VaultCatalogPackageVo;
import xin.v5ai.vault.exception.VaultBusinessException;
import xin.v5ai.vault.VaultErrorCodes;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Seeded official catalog. Rejects publishing tags; never grants publish:* packages.
 */
@Service
public class VaultCatalogService {

    private static final Set<String> FORBIDDEN_TAGS = Set.of("publishing", "publish", "publisher");

    private final List<SeedEntry> seeds = List.of(
        seedPlugin(),
        seedTheme()
    );

    public VaultCatalogListVo list(String kind) {
        VaultCatalogListVo vo = new VaultCatalogListVo();
        vo.setCatalogProtocolVersion(CatalogProtocol.PROTOCOL_VERSION);
        vo.setFileSyncResource(false);
        List<VaultCatalogItemVo> items = new ArrayList<>();
        for (SeedEntry seed : seeds) {
            if (hasForbiddenTag(seed.item.getTags())) {
                continue;
            }
            if (kind != null && !kind.isBlank() && !kind.equalsIgnoreCase(seed.item.getKind())) {
                continue;
            }
            items.add(copyItem(seed.item));
        }
        vo.setItems(items);
        return vo;
    }

    public VaultCatalogItemVo get(String id) {
        SeedEntry seed = find(id);
        if (hasForbiddenTag(seed.item.getTags())) {
            throw new VaultBusinessException(400, VaultErrorCodes.PATH_INVALID, "拒绝 publishing 类目录条目");
        }
        return copyItem(seed.item);
    }

    public VaultCatalogPackageVo packageOf(String id) {
        SeedEntry seed = find(id);
        if (hasForbiddenTag(seed.item.getTags())) {
            throw new VaultBusinessException(400, VaultErrorCodes.PATH_INVALID, "拒绝 publishing 类目录包");
        }
        VaultCatalogPackageVo vo = new VaultCatalogPackageVo();
        vo.setCatalogProtocolVersion(CatalogProtocol.PROTOCOL_VERSION);
        vo.setFileSyncResource(false);
        vo.setId(seed.item.getId());
        vo.setKind(seed.item.getKind());
        vo.setVersion(seed.item.getVersion());
        vo.setFiles(new LinkedHashMap<>(seed.files));
        return vo;
    }

    private SeedEntry find(String id) {
        for (SeedEntry seed : seeds) {
            if (seed.item.getId().equals(id)) {
                return seed;
            }
        }
        throw new VaultBusinessException(404, VaultErrorCodes.NOT_FOUND, "catalog 条目不存在: " + id);
    }

    static boolean hasForbiddenTag(List<String> tags) {
        if (tags == null) {
            return false;
        }
        for (String tag : tags) {
            if (tag != null && FORBIDDEN_TAGS.contains(tag.trim().toLowerCase(Locale.ROOT))) {
                return true;
            }
        }
        return false;
    }

    private static VaultCatalogItemVo copyItem(VaultCatalogItemVo src) {
        VaultCatalogItemVo vo = new VaultCatalogItemVo();
        vo.setId(src.getId());
        vo.setName(src.getName());
        vo.setKind(src.getKind());
        vo.setVersion(src.getVersion());
        vo.setDescription(src.getDescription());
        vo.setAuthor(src.getAuthor());
        vo.setMinAppVersion(src.getMinAppVersion());
        vo.setPermissions(new ArrayList<>(src.getPermissions()));
        vo.setTags(new ArrayList<>(src.getTags()));
        vo.setNetworkAllowlist(new ArrayList<>(src.getNetworkAllowlist()));
        vo.setPackagePath(src.getPackagePath());
        return vo;
    }

    private static SeedEntry seedPlugin() {
        VaultCatalogItemVo item = new VaultCatalogItemVo();
        item.setId("safe-fetch-demo");
        item.setName("Safe Fetch Demo");
        item.setKind("plugin");
        item.setVersion("1.0.0");
        item.setDescription("官方示例：network:safe 白名单 GET + Ribbon/SettingTab");
        item.setAuthor("v5notes");
        item.setMinAppVersion("0.1.0");
        item.setPermissions(List.of("ui:commands", "ui:ribbon", "ui:settings", "network:safe"));
        item.setTags(List.of("demo", "network", "official"));
        item.setNetworkAllowlist(List.of("httpbin.org"));
        item.setPackagePath("/vault/v1/catalog/plugins/safe-fetch-demo/package");

        Map<String, String> files = new LinkedHashMap<>();
        files.put("manifest.json", """
            {
              "id": "safe-fetch-demo",
              "name": "Safe Fetch Demo",
              "kind": "plugin",
              "version": "1.0.0",
              "minAppVersion": "0.1.0",
              "description": "官方示例：network:safe 白名单 GET + Ribbon/SettingTab",
              "author": "v5notes",
              "permissions": ["ui:commands", "ui:ribbon", "ui:settings", "network:safe"],
              "networkAllowlist": ["httpbin.org"],
              "tags": ["demo", "network", "official"],
              "main": "main.js"
            }
            """);
        files.put("main.js", """
            module.exports = class SafeFetchDemoPlugin extends Plugin {
              async onload() {
                this.addCommand({
                  id: 'ping-httpbin',
                  name: 'Ping httpbin (network:safe)',
                  callback: async () => {
                    try {
                      const res = await this.app.network.request('https://httpbin.org/get?from=v5notes-vault')
                      this.app.workspace.openNotice('httpbin OK · status ' + res.status)
                    } catch (e) {
                      this.app.workspace.openNotice('network:safe 失败: ' + (e && e.message ? e.message : String(e)))
                    }
                  },
                })
                this.addRibbonIcon({
                  id: 'safe-fetch-ribbon',
                  title: 'Safe Fetch',
                  icon: 'SF',
                  callback: async () => {
                    this.app.workspace.openNotice('Ribbon → 使用命令「Ping httpbin」')
                  },
                })
                this.addSettingTab({
                  id: 'safe-fetch-settings',
                  name: 'Safe Fetch',
                  display: (el) => {
                    el.innerHTML = ''
                    const p = document.createElement('p')
                    p.textContent = '仅允许访问 httpbin.org。无第三方发布。'
                    el.appendChild(p)
                  },
                })
              }
            }
            """);
        return new SeedEntry(item, files);
    }

    private static SeedEntry seedTheme() {
        VaultCatalogItemVo item = new VaultCatalogItemVo();
        item.setId("catalog-moss");
        item.setName("Catalog Moss");
        item.setKind("theme");
        item.setVersion("1.0.0");
        item.setDescription("官方 catalog 示例主题（柔和苔绿）");
        item.setAuthor("v5notes");
        item.setMinAppVersion("0.1.0");
        item.setPermissions(List.of("ui:theme"));
        item.setTags(List.of("demo", "theme", "official"));
        item.setPackagePath("/vault/v1/catalog/plugins/catalog-moss/package");

        Map<String, String> files = new LinkedHashMap<>();
        files.put("manifest.json", """
            {
              "id": "catalog-moss",
              "name": "Catalog Moss",
              "kind": "theme",
              "version": "1.0.0",
              "minAppVersion": "0.1.0",
              "description": "官方 catalog 示例主题（柔和苔绿）",
              "author": "v5notes",
              "permissions": ["ui:theme"],
              "tags": ["demo", "theme", "official"],
              "theme": "theme.css"
            }
            """);
        files.put("theme.css", """
            :root {
              --bg: #f3f6f1;
              --surface: #ffffff;
              --ink: #1e2a22;
              --muted: #5c6b60;
              --accent: #3d6b4f;
              --line: #d5e0d6;
            }
            """);
        return new SeedEntry(item, files);
    }

    private record SeedEntry(VaultCatalogItemVo item, Map<String, String> files) {
    }
}
