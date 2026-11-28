package xin.v5ai.basics.file.service.impl;

import com.baomidou.mybatisplus.core.MybatisConfiguration;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.apache.ibatis.builder.MapperBuilderAssistant;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import xin.v5ai.basics.file.core.enums.FileConfigPurpose;
import xin.v5ai.basics.file.domain.FileInfo;
import xin.v5ai.basics.file.domain.bo.FileConfigSearchBo;
import xin.v5ai.basics.file.domain.vo.FileConfigVo;
import xin.v5ai.basics.file.domain.vo.FileInfoVo;
import xin.v5ai.basics.file.mapper.FileInfoMapper;
import xin.v5ai.basics.file.service.IFileConfigService;
import xin.v5ai.common.core.domain.PageResult;
import xin.v5ai.common.mybatis.core.page.PageQuery;

import java.lang.reflect.Field;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 验证 Cloud 媒体库查询（queryMyMedia / queryMyImages）会隔离 Vault 同步附件。
 */
class FileInfoMyMediaFilterTest {

    @BeforeAll
    static void initTableMetadata() {
        TableInfoHelper.initTableInfo(
            new MapperBuilderAssistant(new MybatisConfiguration(), "fileInfo"), FileInfo.class);
    }

    private FileInfoMapper mapper;
    private IFileConfigService fileConfigService;
    private FileInfoServiceImpl service;

    @BeforeEach
    void setUp() throws Exception {
        mapper = mock(FileInfoMapper.class);
        fileConfigService = mock(IFileConfigService.class);
        service = new FileInfoServiceImpl(mapper);

        Field configField = FileInfoServiceImpl.class.getDeclaredField("fileConfigService");
        configField.setAccessible(true);
        configField.set(service, fileConfigService);

        when(mapper.selectVoPage(any(), any())).thenReturn(new Page<>(1, 24, 0));
    }

    @Test
    void queryMyMediaExcludesVaultPathsAndVaultAssetConfigs() {
        FileConfigVo vaultCfg = new FileConfigVo();
        vaultCfg.setId(99L);
        vaultCfg.setPurpose(FileConfigPurpose.VAULT_ASSET);
        when(fileConfigService.queryList(any())).thenReturn(List.of(vaultCfg));

        service.queryMyMedia(1001L, "video", "clip", new PageQuery(1, 24));

        ArgumentCaptor<FileConfigSearchBo> boCaptor = ArgumentCaptor.forClass(FileConfigSearchBo.class);
        verify(fileConfigService).queryList(boCaptor.capture());
        assertEquals(FileConfigPurpose.VAULT_ASSET, boCaptor.getValue().getPurpose());

        @SuppressWarnings("unchecked")
        ArgumentCaptor<LambdaQueryWrapper<FileInfo>> wrapperCaptor = ArgumentCaptor.forClass(LambdaQueryWrapper.class);
        verify(mapper).selectVoPage(any(), wrapperCaptor.capture());

        LambdaQueryWrapper<FileInfo> wrapper = wrapperCaptor.getValue();
        String sql = wrapper.getSqlSegment();
        assertTrue(sql.contains("NOT LIKE"), "应排除包含 /vault/ 的同步附件路径: " + sql);
        assertTrue(sql.contains("NOT IN"), "应排除 VAULT_ASSET 配置下的文件: " + sql);
        assertTrue(wrapper.getParamNameValuePairs().containsValue("%/vault/%"));
        assertTrue(wrapper.getParamNameValuePairs().containsValue("video/%"));
        assertTrue(wrapper.getParamNameValuePairs().containsValue(99L));
    }

    @Test
    void queryMyImagesAlsoExcludesVaultPathsWhenNoVaultAssetConfigExists() {
        when(fileConfigService.queryList(any())).thenReturn(List.of());

        service.queryMyImages(1001L, null, new PageQuery(1, 24));

        @SuppressWarnings("unchecked")
        ArgumentCaptor<LambdaQueryWrapper<FileInfo>> wrapperCaptor = ArgumentCaptor.forClass(LambdaQueryWrapper.class);
        verify(mapper).selectVoPage(any(), wrapperCaptor.capture());

        LambdaQueryWrapper<FileInfo> wrapper = wrapperCaptor.getValue();
        String sql = wrapper.getSqlSegment();
        assertTrue(sql.contains("NOT LIKE"), "无 VAULT_ASSET 配置时也应排除 /vault/ 路径: " + sql);
        assertFalse(sql.contains("NOT IN"), "无 VAULT_ASSET 配置时不应生成空的 NOT IN: " + sql);
        assertTrue(wrapper.getParamNameValuePairs().containsValue("%/vault/%"));
        assertTrue(wrapper.getParamNameValuePairs().containsValue("image/%"));
    }

    @Test
    void queryMyMediaSupportsAudioAndRejectsUnknownKindOrNullUser() {
        when(fileConfigService.queryList(any())).thenReturn(List.of());

        service.queryMyMedia(1001L, "audio", null, new PageQuery(1, 24));
        @SuppressWarnings("unchecked")
        ArgumentCaptor<LambdaQueryWrapper<FileInfo>> wrapperCaptor = ArgumentCaptor.forClass(LambdaQueryWrapper.class);
        verify(mapper).selectVoPage(any(), wrapperCaptor.capture());
        LambdaQueryWrapper<FileInfo> wrapper = wrapperCaptor.getValue();
        String sql = wrapper.getSqlSegment();
        assertTrue(sql.contains("NOT LIKE"), sql);
        assertTrue(wrapper.getParamNameValuePairs().containsValue("audio/%"));
        assertTrue(wrapper.getParamNameValuePairs().containsValue("application/ogg"));

        PageResult<FileInfoVo> unknown = service.queryMyMedia(1001L, "other", null, new PageQuery(1, 24));
        assertEquals(0L, unknown.getTotal());

        PageResult<FileInfoVo> anonymous = service.queryMyMedia(null, "video", null, new PageQuery(1, 24));
        assertEquals(0L, anonymous.getTotal());
        verify(mapper).selectVoPage(any(), any());
    }
}
