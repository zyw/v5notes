package xin.v5ai.vault.catalog;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import xin.v5ai.common.core.constant.HttpStatus;
import xin.v5ai.vault.VaultErrorCodes;
import xin.v5ai.vault.domain.bo.admin.VaultCatalogSaveBo;
import xin.v5ai.vault.domain.vo.admin.VaultCatalogZipPreviewVo;
import xin.v5ai.vault.exception.VaultBusinessException;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * 扩展 zip 包安全解析器（防 Zip Slip、单文件与总包体积有界读取、严格 UTF-8 解码）。
 */
public final class VaultCatalogZipParser {

    private VaultCatalogZipParser() {
    }

    public static VaultCatalogZipPreviewVo parse(InputStream input, JsonMapper mapper) {
        if (input == null) {
            throw badRequest("请选择 zip 扩展包文件");
        }
        Map<String, String> files = new LinkedHashMap<>();
        long totalBytes = 0L;
        int entryCount = 0;

        try (ZipInputStream zis = new ZipInputStream(input, StandardCharsets.UTF_8)) {
            ZipEntry entry;
            while ((entry = zis.getNextEntry()) != null) {
                if (entry.isDirectory()) {
                    zis.closeEntry();
                    continue;
                }
                entryCount++;
                if (entryCount > VaultCatalogValidator.MAX_PACKAGE_ENTRIES) {
                    throw badRequest("扩展包文件数量超过上限（" + VaultCatalogValidator.MAX_PACKAGE_ENTRIES + "）");
                }
                String name = entry.getName();
                if (!VaultCatalogValidator.isSafeFlatEntryName(name)) {
                    throw badRequest("扩展包内文件名不合法「" + name + "」：只支持根目录下的单层文件");
                }
                byte[] raw = readEntryBounded(zis, name);
                totalBytes += raw.length;
                if (totalBytes > VaultCatalogValidator.MAX_TOTAL_PACKAGE_BYTES) {
                    throw badRequest("扩展包解压后超过 4 MiB 上限");
                }
                String text = decodeStrictUtf8(name, raw);
                files.put(name, text);
                zis.closeEntry();
            }
        } catch (VaultBusinessException ex) {
            throw ex;
        } catch (Exception ex) {
            throw badRequest("解析扩展包失败: " + ex.getMessage());
        }

        String manifestRaw = files.get("manifest.json");
        if (manifestRaw == null || manifestRaw.isBlank()) {
            throw badRequest("扩展包缺少根目录下的 manifest.json");
        }

        JsonNode root;
        try {
            root = mapper.readTree(manifestRaw);
        } catch (Exception ex) {
            throw badRequest("manifest.json 不是有效的 JSON");
        }
        if (root == null || !root.isObject()) {
            throw badRequest("manifest.json 必须是 JSON 对象");
        }

        VaultCatalogSaveBo bo = new VaultCatalogSaveBo();
        bo.setId(textOrNull(root, "id"));
        bo.setName(textOrNull(root, "name"));
        String kind = textOrNull(root, "kind");
        bo.setKind(kind == null || kind.isBlank() ? "plugin" : kind);
        bo.setVersion(textOrNull(root, "version"));
        bo.setMinAppVersion(textOrNull(root, "minAppVersion"));
        bo.setDescription(textOrNull(root, "description"));
        bo.setAuthor(textOrNull(root, "author"));
        bo.setAuthorUrl(textOrNull(root, "authorUrl"));
        bo.setPermissions(readStringArray(root.get("permissions")));
        bo.setNetworkAllowlist(readStringArray(root.get("networkAllowlist")));
        bo.setTags(readStringArray(root.get("tags")));
        bo.setFiles(files);

        VaultCatalogValidator.ValidatedPackage validated = VaultCatalogValidator.validate(bo);
        VaultCatalogZipPreviewVo vo = new VaultCatalogZipPreviewVo();
        vo.setId(validated.id());
        vo.setName(validated.name());
        vo.setKind(validated.kind());
        vo.setVersion(validated.version());
        vo.setMinAppVersion(validated.minAppVersion());
        vo.setDescription(validated.description());
        vo.setAuthor(validated.author());
        vo.setAuthorUrl(validated.authorUrl());
        vo.setPermissions(validated.permissions());
        vo.setNetworkAllowlist(validated.networkAllowlist());
        vo.setTags(validated.tags());
        vo.setFiles(validated.files());
        vo.setWarnings(validated.warnings());
        return vo;
    }

    private static byte[] readEntryBounded(ZipInputStream zis, String name) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        int n;
        int total = 0;
        while ((n = zis.read(buf)) != -1) {
            total += n;
            if (total > VaultCatalogValidator.MAX_SINGLE_FILE_BYTES) {
                throw badRequest("文件「" + name + "」超过 1 MiB 上限");
            }
            out.write(buf, 0, n);
        }
        return out.toByteArray();
    }

    private static String decodeStrictUtf8(String name, byte[] raw) {
        try {
            return StandardCharsets.UTF_8.newDecoder()
                .onMalformedInput(CodingErrorAction.REPORT)
                .onUnmappableCharacter(CodingErrorAction.REPORT)
                .decode(ByteBuffer.wrap(raw))
                .toString();
        } catch (CharacterCodingException ex) {
            throw badRequest("文件「" + name + "」不是有效的 UTF-8 文本，扩展包只接受文本文件");
        }
    }

    private static String textOrNull(JsonNode root, String field) {
        JsonNode node = root.get(field);
        if (node == null || node.isNull()) {
            return null;
        }
        return node.asString();
    }

    private static List<String> readStringArray(JsonNode node) {
        if (node == null || !node.isArray()) {
            return List.of();
        }
        List<String> out = new ArrayList<>();
        for (JsonNode child : node) {
            if (child != null && !child.isNull()) {
                String text = child.asString();
                if (text != null && !text.isBlank()) {
                    out.add(text.trim());
                }
            }
        }
        return out;
    }

    private static VaultBusinessException badRequest(String message) {
        return new VaultBusinessException(HttpStatus.BAD_REQUEST, VaultErrorCodes.PATH_INVALID, message);
    }
}
