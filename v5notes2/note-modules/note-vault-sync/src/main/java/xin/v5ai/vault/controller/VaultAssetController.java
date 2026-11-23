package xin.v5ai.vault.controller;

import cn.dev33.satoken.annotation.SaCheckLogin;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import xin.v5ai.common.core.constant.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import xin.v5ai.common.core.domain.R;
import xin.v5ai.common.satoken.utils.LoginHelper;
import xin.v5ai.common.web.core.BaseController;
import xin.v5ai.vault.VaultErrorCodes;
import xin.v5ai.vault.VaultHttpStatus;
import xin.v5ai.vault.domain.VaultAssetRef;
import xin.v5ai.vault.exception.VaultBusinessException;
import xin.v5ai.vault.service.IVaultAssetService;

import java.io.InputStream;
import java.io.OutputStream;

/**
 * Attachment objects: upload once, then reference from {@code PUT /files} (design §4.3).
 *
 * <p>Deliberately not {@code /basics/base/file}: that endpoint is {@code @SaIgnore} and does
 * not check ownership, so exposing it to sync clients would publish the whole file library
 * (design §3.1). Everything here is scoped by {@code vault_id + user_id}.</p>
 */
@Slf4j
@SaCheckLogin
@RequiredArgsConstructor
@RestController
@RequestMapping("/vault/v1/vaults/{vaultId}/assets")
public class VaultAssetController extends BaseController {

    private final IVaultAssetService assetService;

    /**
     * Stores an attachment body, deduplicating by content hash within the vault.
     *
     * <p>The body is streamed, never buffered: a 25MB PDF must not become a 25MB {@code byte[]}
     * on the way to the backend (design §5.2).</p>
     */
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public R<?> upload(@PathVariable String vaultId,
                       @RequestParam("file") MultipartFile file,
                       @RequestParam("sha256") String sha256) throws Exception {
        Long userId = LoginHelper.getUserId();
        Long id = Long.parseLong(vaultId);
        if (file == null || file.isEmpty()) {
            throw new VaultBusinessException(HttpStatus.BAD_REQUEST, VaultErrorCodes.PATH_INVALID, "缺少文件内容");
        }
        try (InputStream in = file.getInputStream()) {
            IVaultAssetService.StoredResult stored = assetService.upload(
                userId, id, in, file.getSize(), sha256, file.getContentType());
            return R.ok(stored);
        }
    }

    /**
     * Streams an attachment body, honouring {@code Range} for resumable downloads.
     *
     * <p>Proxy backends (FTP / local / DB) have no direct URL, so this endpoint is their only
     * read path; S3 clients normally bypass it via the presigned link returned by
     * {@code GET /files/content}.</p>
     */
    @GetMapping("/{assetId}/content")
    public void content(@PathVariable String vaultId,
                        @PathVariable String assetId,
                        @RequestHeader(value = HttpHeaders.RANGE, required = false) String range,
                        HttpServletResponse response) throws Exception {
        Long userId = LoginHelper.getUserId();
        Long id = Long.parseLong(vaultId);
        assetService.requireOwned(userId, id, assetId);

        VaultAssetRef ref = assetService.findByAssetIdForRead(id, assetId);
        if (ref == null) {
            throw new VaultBusinessException(HttpStatus.NOT_FOUND, VaultErrorCodes.ASSET_NOT_FOUND, "附件对象不存在");
        }
        long total = ref.getSizeBytes() == null ? 0L : ref.getSizeBytes();
        long[] window = parseRange(range, total);

        if (window[0] > 0 || window[1] < total) {
            response.setStatus(VaultHttpStatus.PARTIAL_CONTENT);
            response.setHeader(HttpHeaders.CONTENT_RANGE,
                "bytes " + window[0] + "-" + (window[0] + window[1] - 1) + "/" + total);
        }
        response.setHeader(HttpHeaders.ACCEPT_RANGES, "bytes");
        response.setHeader("X-Content-Hash", ref.getSha256());
        if (ref.getMimeType() != null && !ref.getMimeType().isBlank()) {
            response.setContentType(ref.getMimeType());
        }
        response.setContentLengthLong(window[1]);

        try (OutputStream out = response.getOutputStream()) {
            assetService.streamTo(ref, window[0], window[1], out);
            out.flush();
        }
    }

    /**
     * Parses a single {@code bytes=a-b} range.
     *
     * @return {@code [offset, length]}; a missing or unsupported header yields the whole object
     */
    static long[] parseRange(String range, long total) {
        if (range == null || range.isBlank() || total <= 0) {
            return new long[]{0L, total};
        }
        String value = range.trim();
        if (!value.startsWith("bytes=")) {
            return new long[]{0L, total};
        }
        String spec = value.substring("bytes=".length()).split(",")[0].trim();
        int dash = spec.indexOf('-');
        if (dash < 0) {
            return new long[]{0L, total};
        }
        try {
            long start;
            long end;
            String left = spec.substring(0, dash).trim();
            String right = spec.substring(dash + 1).trim();
            if (left.isEmpty()) {
                // Suffix form: last N bytes.
                long suffix = Long.parseLong(right);
                if (suffix <= 0) {
                    return new long[]{0L, total};
                }
                start = Math.max(0, total - suffix);
                end = total - 1;
            } else {
                start = Long.parseLong(left);
                end = right.isEmpty() ? total - 1 : Long.parseLong(right);
            }
            if (start < 0 || start >= total) {
                return new long[]{0L, total};
            }
            end = Math.min(end, total - 1);
            if (end < start) {
                return new long[]{0L, total};
            }
            return new long[]{start, end - start + 1};
        } catch (NumberFormatException ex) {
            return new long[]{0L, total};
        }
    }
}
