package xin.v5ai.basics.file.admin.controller;

import xin.v5ai.common.core.utils.MessageUtils;
import cn.dev33.satoken.annotation.SaCheckPermission;
import cn.dev33.satoken.annotation.SaIgnore;
import cn.hutool.core.io.IoUtil;
import cn.hutool.core.util.StrUtil;
import cn.hutool.core.util.URLUtil;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import xin.v5ai.basics.file.domain.FileInfo;
import xin.v5ai.basics.file.domain.bo.FileInfoSearchBo;
import xin.v5ai.basics.file.domain.bo.FileUploadBo;
import xin.v5ai.basics.file.domain.vo.FileInfoVo;
import xin.v5ai.basics.file.domain.vo.FileUploadVo;
import xin.v5ai.basics.file.service.IFileInfoService;
import xin.v5ai.common.core.domain.R;
import xin.v5ai.common.core.utils.MapstructUtils;
import xin.v5ai.common.core.utils.file.FileUtils;
import xin.v5ai.common.excel.utils.ExcelBuilder;
import xin.v5ai.common.log.annotation.Log;
import xin.v5ai.common.log.enums.BusinessType;
import xin.v5ai.common.mybatis.core.page.PageQuery;
import xin.v5ai.common.core.domain.PageResult;
import xin.v5ai.common.web.core.BaseController;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Arrays;
import java.util.List;

/**
 * 文件管理配置接口
 *
 * @author ZYW
 * @date 2024-04-10
 */
@Slf4j
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/basics/admin/file")
public class FileController extends BaseController {

    private final IFileInfoService fileInfoService;

    /**
     * 查询文件路径列表
     */
    @SaCheckPermission("basics:file:list")
    @GetMapping("/list")
    public R<PageResult<FileInfoVo>> list(FileInfoSearchBo bo, PageQuery pageQuery) {
        return R.ok(fileInfoService.queryPageList(bo, pageQuery));
    }

    /**
     * 查询文件对象基于id串
     *
     * @param ids 文件对象ID串
     */
    @SaCheckPermission("basics:file:list")
    @GetMapping("/listByIds/{ids}")
    public R<List<FileUploadVo>> listByIds(@NotEmpty(message = "{id.not.null}")
                                       @PathVariable Long[] ids) {
        List<FileUploadVo> list = fileInfoService.queryByIds(Arrays.asList(ids));
        return R.ok(list);
    }

    /**
     * 导出文件路径列表
     */
    @SaCheckPermission("basics:file:export")
    @Log(title = "文件路径", businessType = BusinessType.EXPORT)
    @PostMapping("/export")
    public void export(FileInfoSearchBo bo, HttpServletResponse response) {
        List<FileInfoVo> list = fileInfoService.queryList(bo);
        ExcelBuilder.of(list, FileInfoVo.class).sheetName("文件路径").toResponse(response);
    }

    /**
     * 获取文件路径详细信息
     *
     * @param id 主键
     */
    @SaCheckPermission("basics:file:query")
    @GetMapping("/{id}")
    public R<FileInfoVo> getInfo(@NotNull(message = "{id.not.null}")
                                     @PathVariable Long id) {
        return R.ok(fileInfoService.queryById(id));
    }

    /**
     * 上传文件
     */
    @SaCheckPermission("basics:file:upload")
    @Log(title = "文件上传，对象存储", businessType = BusinessType.INSERT,isSaveRequestData = false)
    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public R<FileUploadVo> upload(@Validated FileUploadBo bo) throws Exception {
        MultipartFile file = bo.getFile();
        String path = bo.getPath();
        FileInfo info = fileInfoService.uploadByBo(file.getOriginalFilename(), path, IoUtil.readBytes(file.getInputStream()));
        FileInfoVo fileInfoVo = fileInfoService.matchingUrl(MapstructUtils.convert(info, FileInfoVo.class));

        FileUploadVo vo = FileUploadVo.builder()
            .url(fileInfoVo.getUrl())
            .path(info.getPath())
            .id(info.getId())
            .build();

        return R.ok(MessageUtils.message("file.upload.success"), vo);
    }

    /**
     * 删除文件路径
     *
     * @param ids 主键串
     */
    @SaCheckPermission("basics:file:remove")
    @Log(title = "文件路径", businessType = BusinessType.DELETE)
    @DeleteMapping("/{ids}")
    public R<Void> remove(@NotEmpty(message = "{id.not.null}")
                          @PathVariable Long[] ids) {
        return toAjax(fileInfoService.deleteWithValidByIds(List.of(ids), true));
    }

    /**
     * 文件下载
     * @param request
     * @param response
     * @param configId
     * @throws Exception
     */
//    @SaIgnore
    @SaCheckPermission("basics:file:download")
    @GetMapping("/{configId}/get/**")
    public void getFileContent(HttpServletRequest request,
                               HttpServletResponse response,
                               @PathVariable("configId") Long configId) throws Exception {
        // 获取请求的路径
        String path = StrUtil.subAfter(request.getRequestURI(), "/get/", false);
        if (StrUtil.isEmpty(path)) {
            throw new IllegalArgumentException("结尾的 path 路径必须传递");
        }
        // 解码，解决中文路径的问题
        path = URLUtil.decode(path);
        // 读取内容
        byte[] content = fileInfoService.getFileContent(configId, path);
        if (content == null) {
            log.warn("[getFileContent][configId({}) path({}) 文件不存在]", configId, path);
            response.setStatus(HttpStatus.NOT_FOUND.value());
            return;
        }
        writeAttachment(response, path, content);
    }

    /**
     * 文件下载（使用文件原名）
     * @param response
     * @param id 文件ID
     * @throws Exception
     */
//    @SaIgnore
    @SaCheckPermission("basics:file:download")
    @GetMapping("/download/{id}")
    public void download(HttpServletResponse response,@PathVariable("id") Long id) throws Exception {
        FileInfoVo fileInfoVo = fileInfoService.queryById(id);
        Long configId = fileInfoVo.getConfigId();
        String path = fileInfoVo.getPath();
        String name = fileInfoVo.getName();
        // 读取内容
        byte[] content = fileInfoService.getFileContent(configId, path);
        if (content == null) {
            log.warn("[getFileContent][configId({}) path({}) 文件不存在]", configId, path);
            response.setStatus(HttpStatus.NOT_FOUND.value());
            return;
        }
        writeAttachment(response, name, content);
    }

    /**
     * 以附件形式输出文件内容（移植自旧 common-core 的 ServletUtils.writeAttachment）。
     *
     * @param response 响应对象
     * @param fileName 文件名
     * @param content  文件内容
     * @throws Exception 输出异常
     */
    private void writeAttachment(HttpServletResponse response, String fileName, byte[] content) throws Exception {
        response.reset();
        FileUtils.setAttachmentResponseHeader(response, fileName);
        response.setContentLength(content.length);
        response.getOutputStream().write(content);
        response.getOutputStream().flush();
    }
}
