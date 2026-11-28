package xin.v5ai.basics.file.core.utils;

import cn.hutool.core.io.file.FileNameUtil;
import lombok.SneakyThrows;
import org.apache.tika.Tika;
import org.apache.tika.mime.MimeTypeException;
import org.apache.tika.mime.MimeTypes;

import java.util.Locale;
import java.util.Map;

/**
 * 文件类型工具类
 *
 * @author ZYW
 */
public class FileTypeUtils {

    private static final ThreadLocal<Tika> TIKA = ThreadLocal.withInitial(Tika::new);

    private static final Map<String, String> MIME_TO_EXTENSION = Map.ofEntries(
        Map.entry("image/jpeg", "jpg"),
        Map.entry("image/jpg", "jpg"),
        Map.entry("image/png", "png"),
        Map.entry("image/gif", "gif"),
        Map.entry("image/webp", "webp"),
        Map.entry("image/bmp", "bmp"),
        Map.entry("image/x-ms-bmp", "bmp"),
        Map.entry("image/svg+xml", "svg"),
        Map.entry("image/x-icon", "ico"),
        Map.entry("image/vnd.microsoft.icon", "ico"),
        Map.entry("image/avif", "avif"),
        Map.entry("image/tiff", "tiff"),
        Map.entry("application/pdf", "pdf"),
        Map.entry("text/plain", "txt"),
        Map.entry("text/markdown", "md"),
        Map.entry("application/json", "json"),
        Map.entry("text/html", "html"),
        Map.entry("text/css", "css"),
        Map.entry("application/javascript", "js"),
        Map.entry("text/javascript", "js"),
        Map.entry("application/xml", "xml"),
        Map.entry("text/xml", "xml"),
        Map.entry("application/zip", "zip"),
        Map.entry("application/msword", "doc"),
        Map.entry("application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"),
        Map.entry("application/vnd.ms-excel", "xls"),
        Map.entry("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx"),
        Map.entry("application/vnd.ms-powerpoint", "ppt"),
        Map.entry("application/vnd.openxmlformats-officedocument.presentationml.presentation", "pptx"),
        Map.entry("audio/mpeg", "mp3"),
        Map.entry("video/mp4", "mp4")
    );

    /**
     * 获得文件的 mineType，对于doc，jar等文件会有误差
     *
     * @param data 文件内容
     * @return mineType 无法识别时会返回“application/octet-stream”
     */
    @SneakyThrows
    public static String getMineType(byte[] data) {
        return TIKA.get().detect(data);
    }

    /**
     * 已知文件名，获取文件类型，在某些情况下比通过字节数组准确，例如使用jar文件时，通过名字更为准确
     *
     * @param fileName 文件名
     * @return mineType 无法识别时会返回“application/octet-stream”
     */
    public static String getMineType(String fileName) {
        return TIKA.get().detect(fileName);
    }

    /**
     * 在拥有文件和数据的情况下，最好使用此方法，最为准确
     *
     * @param fileName 文件名
     * @param data 文件内容
     * @return mineType 无法识别时会返回“application/octet-stream”
     */
    public static String getMineType(String fileName, byte[] data) {
        return TIKA.get().detect(data, fileName);
    }

    /**
     * 在拥有文件和数据的情况下，最好使用此方法，最为准确
     *
     * @param data 文件内容
     * @param name 文件名
     * @return mineType 无法识别时会返回“application/octet-stream”
     */
    public static String getMineType(byte[] data, String name) {
        return TIKA.get().detect(data, name);
    }

    /**
     * 根据 MIME 类型推断不带点号的小写文件后缀；无法识别或通用二进制流返回空串。
     */
    public static String getExtensionByMimeType(String mimeType) {
        if (mimeType == null || mimeType.isBlank()) {
            return "";
        }
        String normalized = mimeType.split(";", 2)[0].trim().toLowerCase(Locale.ROOT);
        if (normalized.isEmpty() || "application/octet-stream".equals(normalized)) {
            return "";
        }
        String mapped = MIME_TO_EXTENSION.get(normalized);
        if (mapped != null) {
            return mapped;
        }
        try {
            String ext = MimeTypes.getDefaultMimeTypes().forName(normalized).getExtension();
            if (ext == null || ext.isBlank()) {
                return "";
            }
            return ext.startsWith(".") ? ext.substring(1).toLowerCase(Locale.ROOT) : ext.toLowerCase(Locale.ROOT);
        } catch (MimeTypeException ex) {
            return "";
        }
    }

    /**
     * 为无后缀文件名补充后缀（用于无后缀存储对象的下载文件名兜底）。
     */
    public static String appendSuffixIfMissing(String name, String suffix) {
        String base = (name == null || name.isBlank()) ? "file" : name;
        String existing = FileNameUtil.getSuffix(base);
        if ((existing == null || existing.isBlank()) && suffix != null && !suffix.isBlank()) {
            String clean = suffix.trim().replaceFirst("^\\.+", "");
            if (!clean.isEmpty()) {
                return base + "." + clean;
            }
        }
        return base;
    }
}
