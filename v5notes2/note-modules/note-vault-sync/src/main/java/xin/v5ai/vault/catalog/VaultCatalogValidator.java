package xin.v5ai.vault.catalog;

import xin.v5ai.common.core.constant.HttpStatus;
import xin.v5ai.vault.VaultErrorCodes;
import xin.v5ai.vault.domain.bo.admin.VaultCatalogSaveBo;
import xin.v5ai.vault.exception.VaultBusinessException;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 扩展目录服务端安全门禁校验器（对齐客户端 manifest.ts / permissions.ts / cssValidate.ts）。
 */
public final class VaultCatalogValidator {

    public static final int MAX_PACKAGE_ENTRIES = 64;
    public static final int MAX_SINGLE_FILE_BYTES = 1024 * 1024;
    public static final int MAX_TOTAL_PACKAGE_BYTES = 4 * 1024 * 1024;

    private static final Pattern ID_RE = Pattern.compile("^[a-z0-9-]+$");
    private static final Pattern SEMVER_RE = Pattern.compile("^\\d+\\.\\d+\\.\\d+(?:-[0-9A-Za-z.-]+)?$");
    private static final Pattern HOST_RE = Pattern.compile("^(?:\\*\\.)?[a-zA-Z0-9-]+(?:\\.[a-zA-Z0-9-]+)+$");

    public static final Set<String> FORBIDDEN_TAGS = Set.of("publishing", "publish", "publisher");

    public static final Set<String> FORBIDDEN_PERMISSIONS = Set.of(
        "network",
        "publish",
        "publish:*",
        "sync:control",
        "fs:arbitrary",
        "shell"
    );

    public static final Set<String> GRANTABLE_PERMISSIONS = Set.of(
        "vault:read",
        "vault:write",
        "ui:commands",
        "ui:ribbon",
        "ui:status",
        "ui:settings",
        "ui:views",
        "ui:theme",
        "editor:extend",
        "editor:provide",
        "clipboard",
        "network:safe"
    );

    public static final Set<String> THEME_ALLOWED_PERMISSIONS = Set.of("ui:theme", "ui:settings", "ui:commands");

    private static final List<String> REQUIRED_CSS_VARS = List.of(
        "--bg", "--panel", "--ink", "--muted", "--line",
        "--accent", "--accent-hover", "--surface", "--danger", "--danger-bg"
    );

    private static final List<CssRule> DANGEROUS_CSS_RULES = List.of(
        new CssRule(Pattern.compile("\\\\"), "theme.css 禁止 CSS 反斜杠转义序列"),
        new CssRule(Pattern.compile("@import\\b", Pattern.CASE_INSENSITIVE), "theme.css 禁止 @import"),
        new CssRule(Pattern.compile("expression\\s*\\(", Pattern.CASE_INSENSITIVE), "theme.css 禁止 CSS expression()"),
        new CssRule(Pattern.compile("javascript\\s*:", Pattern.CASE_INSENSITIVE), "theme.css 禁止 javascript: URL"),
        new CssRule(Pattern.compile("-moz-binding\\s*:", Pattern.CASE_INSENSITIVE), "theme.css 禁止 -moz-binding"),
        new CssRule(Pattern.compile("behavior\\s*:", Pattern.CASE_INSENSITIVE), "theme.css 禁止 behavior"),
        new CssRule(Pattern.compile("@\\s*document\\b", Pattern.CASE_INSENSITIVE), "theme.css 禁止 @document"),
        new CssRule(Pattern.compile("position\\s*:\\s*fixed\\b", Pattern.CASE_INSENSITIVE), "theme.css 禁止 position:fixed"),
        new CssRule(Pattern.compile("\\*\\s*\\{[^}]*all\\s*:\\s*unset", Pattern.CASE_INSENSITIVE), "theme.css 禁止通用选择器 all:unset"),
        new CssRule(Pattern.compile("\\*\\s*\\{[^}]*(?:display\\s*:\\s*none|visibility\\s*:\\s*hidden)", Pattern.CASE_INSENSITIVE), "theme.css 禁止用 * 选择器隐藏全部 UI"),
        new CssRule(Pattern.compile("url\\s*\\(\\s*['\"]?\\s*(?:https?:|//|data:|file:)", Pattern.CASE_INSENSITIVE), "theme.css 禁止外部或 data/file url()")
    );

    private static final Pattern BARE_ROOT_RE = Pattern.compile("(?:^|[},])\\s*:root\\s*(?=[,{])", Pattern.CASE_INSENSITIVE);
    private static final Pattern CSS_COMMENT_RE = Pattern.compile("/\\*[\\s\\S]*?\\*/");
    private static final Pattern CSS_VAR_DECL_RE = Pattern.compile("(--[a-zA-Z0-9-_]+)\\s*:");

    private VaultCatalogValidator() {
    }

    public record ValidatedPackage(
        String id,
        String name,
        String kind,
        String version,
        String minAppVersion,
        String description,
        String author,
        String authorUrl,
        List<String> permissions,
        List<String> networkAllowlist,
        List<String> tags,
        Map<String, String> files,
        List<String> warnings
    ) {
    }

    /**
     * 校验扩展元数据、安全权限、标签及包内文件，返回规范化后的结果。
     */
    public static ValidatedPackage validate(VaultCatalogSaveBo bo) {
        if (bo == null) {
            throw badRequest("扩展参数不能为空");
        }
        String id = trimToEmpty(bo.getId());
        if (id.isEmpty() || id.length() > 64 || !ID_RE.matcher(id).matches()) {
            throw badRequest("扩展 ID 必须匹配 [a-z0-9-]+ 且不超过 64 字符");
        }
        String name = trimToEmpty(bo.getName());
        if (name.isEmpty() || name.length() > 100) {
            throw badRequest("扩展名称不能为空且不超过 100 字符");
        }
        String kind = trimToEmpty(bo.getKind()).toLowerCase(Locale.ROOT);
        if (!"plugin".equals(kind) && !"theme".equals(kind)) {
            throw badRequest("扩展类型仅支持 plugin 或 theme");
        }
        String version = trimToEmpty(bo.getVersion());
        if (!SEMVER_RE.matcher(version).matches()) {
            throw badRequest("版本号必须符合 semver 格式（例如 1.0.0）");
        }
        String minAppVersion = trimToEmpty(bo.getMinAppVersion());
        if (minAppVersion.isEmpty()) {
            minAppVersion = "0.1.0";
        } else if (!SEMVER_RE.matcher(minAppVersion).matches()) {
            throw badRequest("minAppVersion 必须符合 semver 格式");
        }

        List<String> tags = normalizeList(bo.getTags(), true);
        for (String tag : tags) {
            if (FORBIDDEN_TAGS.contains(tag)) {
                throw badRequest("拒绝 publishing 类标签「" + tag + "」（第三方无发布；发布仅为官方功能）");
            }
        }

        List<String> permissions = normalizeList(bo.getPermissions(), false);
        if ("theme".equals(kind) && permissions.isEmpty()) {
            permissions = List.of("ui:theme");
        }
        validatePermissions(kind, permissions);

        List<String> allowlist = normalizeList(bo.getNetworkAllowlist(), false);
        if (permissions.contains("network:safe")) {
            validateAllowlist(allowlist);
        }

        Map<String, String> files = validateFiles(bo.getFiles());
        List<String> warnings = new ArrayList<>();
        if ("plugin".equals(kind)) {
            if (!files.containsKey("main.js") || trimToEmpty(files.get("main.js")).isEmpty()) {
                throw badRequest("功能插件必须包含非空的 main.js");
            }
        } else {
            String css = files.get("theme.css");
            if (css == null || trimToEmpty(css).isEmpty()) {
                throw badRequest("主题包必须包含非空的 theme.css");
            }
            warnings.addAll(validateThemeCss(css));
        }

        return new ValidatedPackage(
            id,
            name,
            kind,
            version,
            minAppVersion,
            trimToNull(bo.getDescription()),
            trimToNull(bo.getAuthor()),
            trimToNull(bo.getAuthorUrl()),
            permissions,
            allowlist,
            tags,
            files,
            warnings
        );
    }

    public static boolean isSafeFlatEntryName(String name) {
        if (name == null || name.isEmpty() || ".".equals(name) || "..".equals(name)) {
            return false;
        }
        if (name.startsWith(".") || name.contains("/") || name.contains("\\") || name.indexOf('\0') >= 0) {
            return false;
        }
        for (int i = 0; i < name.length(); i++) {
            if (Character.isISOControl(name.charAt(i))) {
                return false;
            }
        }
        return true;
    }

    public static List<String> validateThemeCss(String css) {
        String body = CSS_COMMENT_RE.matcher(css == null ? "" : css).replaceAll("");
        if (body.trim().isEmpty()) {
            throw badRequest("theme.css 内容不能为空");
        }
        for (CssRule rule : DANGEROUS_CSS_RULES) {
            if (rule.pattern.matcher(body).find()) {
                throw badRequest(rule.message);
            }
        }
        if (BARE_ROOT_RE.matcher(body).find()) {
            throw badRequest("theme.css 中以 :root 开头的规则必须限定到本主题，例如 :root[data-community-theme='<id>']");
        }
        Set<String> definedVars = new LinkedHashSet<>();
        Matcher matcher = CSS_VAR_DECL_RE.matcher(body);
        while (matcher.find()) {
            definedVars.add(matcher.group(1));
        }
        List<String> missing = new ArrayList<>();
        for (String required : REQUIRED_CSS_VARS) {
            if (!definedVars.contains(required)) {
                missing.add(required);
            }
        }
        if (missing.size() > REQUIRED_CSS_VARS.size() / 2) {
            throw badRequest("theme.css 缺少过多核心设计变量: " + String.join(", ", missing));
        }
        List<String> warnings = new ArrayList<>();
        if (!missing.isEmpty()) {
            warnings.add("未定义部分设计变量（客户端将回退内置）: " + String.join(", ", missing));
        }
        return warnings;
    }

    private static void validatePermissions(String kind, List<String> permissions) {
        for (String perm : permissions) {
            if (FORBIDDEN_PERMISSIONS.contains(perm) || perm.startsWith("publish:")) {
                throw badRequest("拒绝禁用权限「" + perm + "」（第三方不可用）");
            }
            if (!GRANTABLE_PERMISSIONS.contains(perm)) {
                throw badRequest("不支持的权限声明「" + perm + "」");
            }
        }
        if ("theme".equals(kind)) {
            for (String perm : permissions) {
                if (!THEME_ALLOWED_PERMISSIONS.contains(perm)) {
                    throw badRequest("主题包不得申请越权权限「" + perm + "」");
                }
            }
        }
    }

    private static void validateAllowlist(List<String> allowlist) {
        if (allowlist.isEmpty()) {
            throw badRequest("申请 network:safe 时必须提供非空的 networkAllowlist");
        }
        for (String raw : allowlist) {
            String host = raw.trim();
            if ("*".equals(host) || !HOST_RE.matcher(host).matches()) {
                throw badRequest("networkAllowlist 主机名无效: " + raw);
            }
        }
    }

    private static Map<String, String> validateFiles(Map<String, String> rawFiles) {
        if (rawFiles == null || rawFiles.isEmpty()) {
            throw badRequest("包内文件不能为空");
        }
        if (rawFiles.size() > MAX_PACKAGE_ENTRIES) {
            throw badRequest("扩展包文件数量超过上限（" + MAX_PACKAGE_ENTRIES + "）");
        }
        Map<String, String> out = new LinkedHashMap<>();
        long totalBytes = 0L;
        for (Map.Entry<String, String> entry : rawFiles.entrySet()) {
            String name = entry.getKey();
            if (!isSafeFlatEntryName(name)) {
                throw badRequest("扩展包文件名不合法「" + name + "」：只允许根目录下的单层文件名");
            }
            String content = entry.getValue() == null ? "" : entry.getValue();
            int len = content.getBytes(StandardCharsets.UTF_8).length;
            if (len > MAX_SINGLE_FILE_BYTES) {
                throw badRequest("文件「" + name + "」超过 1 MiB 上限");
            }
            totalBytes += len;
            if (totalBytes > MAX_TOTAL_PACKAGE_BYTES) {
                throw badRequest("扩展包总大小超过 4 MiB 上限");
            }
            out.put(name, content);
        }
        return out;
    }

    private static List<String> normalizeList(List<String> raw, boolean lowerCase) {
        if (raw == null || raw.isEmpty()) {
            return List.of();
        }
        Set<String> set = new LinkedHashSet<>();
        for (String item : raw) {
            if (item == null) {
                continue;
            }
            String trimmed = item.trim();
            if (trimmed.isEmpty()) {
                continue;
            }
            set.add(lowerCase ? trimmed.toLowerCase(Locale.ROOT) : trimmed);
        }
        return new ArrayList<>(set);
    }

    private static String trimToEmpty(String value) {
        return value == null ? "" : value.trim();
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static VaultBusinessException badRequest(String message) {
        return new VaultBusinessException(HttpStatus.BAD_REQUEST, VaultErrorCodes.PATH_INVALID, message);
    }

    private record CssRule(Pattern pattern, String message) {
    }
}
