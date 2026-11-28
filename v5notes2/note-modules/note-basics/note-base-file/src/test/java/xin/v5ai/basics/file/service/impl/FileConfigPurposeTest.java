package xin.v5ai.basics.file.service.impl;

import cn.hutool.extra.spring.SpringUtil;
import com.baomidou.mybatisplus.core.MybatisConfiguration;
import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import jakarta.validation.Validation;
import org.apache.ibatis.builder.MapperBuilderAssistant;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.config.ConfigurableListableBeanFactory;
import org.springframework.context.support.StaticApplicationContext;
import tools.jackson.databind.json.JsonMapper;
import xin.v5ai.basics.file.core.client.FileClient;
import xin.v5ai.basics.file.core.client.FileClientFactory;
import xin.v5ai.basics.file.core.enums.FileConfigPurpose;
import xin.v5ai.basics.file.core.enums.FileStorageEnum;
import xin.v5ai.basics.file.domain.FileConfig;
import xin.v5ai.basics.file.domain.bo.FileConfigBo;
import xin.v5ai.basics.file.mapper.FileConfigMapper;
import xin.v5ai.common.core.exception.ServiceException;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 文件配置用途（设计 D2 / 任务 5b）。
 *
 * <p>钉住四件事：新配置不传用途时落到 {@code GENERIC}；编辑不传用途时沿用原值；同一用途只能
 * 有一条；没有 {@code VAULT_ASSET} 配置时附件链路回退到 {@code GENERIC}，再回退到主配置。</p>
 *
 * <p>错误文案走 {@code MessageUtils}，在 Spring 容器外不可用，因此这里断言的是约束本身
 * （抛异常且不落库、不建客户端），而不是文案内容。</p>
 */
class FileConfigPurposeTest {

    private static final Long ID = 7L;

    /**
     * Lambda 更新构造 SQL 前需要实体表元数据；脱离了 Spring 容器得自己初始化一次
     * （同 note-common-mybatis 的 Lambda* 测试）。
     */
    @BeforeAll
    static void initTableMetadata() {
        TableInfoHelper.initTableInfo(
            new MapperBuilderAssistant(new MybatisConfiguration(), "fileConfig"), FileConfig.class);
    }

    private FileConfigMapper mapper;
    private FileClientFactory factory;
    private FileClient client;
    private FileConfigServiceImpl service;

    /** 承载解析配置所需的 Bean：Jackson 的 ObjectMapper、Hibernate Validator、MessageSource。 */
    private StaticApplicationContext context;

    @BeforeEach
    void setUp() {
        context = new StaticApplicationContext();
        ValidatorFactory validatorFactory = Validation.buildDefaultValidatorFactory();
        context.getBeanFactory().registerSingleton("jsonMapper", JsonMapper.builder().build());
        context.getBeanFactory().registerSingleton("validator", validatorFactory.getValidator());
        context.refresh();
        // SpringUtil 是 BeanFactoryPostProcessor：在真实容器里由 Spring 调用，
        // 测试里手动调用一次，让 JsonUtils / ValidatorUtils 能取到 Bean。
        new SpringUtil().postProcessBeanFactory(context.getBeanFactory());

        mapper = mock(FileConfigMapper.class);
        factory = mock(FileClientFactory.class);
        client = mock(FileClient.class);
        service = new FileConfigServiceImpl(mapper, factory);
    }

    @AfterEach
    void tearDown() {
        context.close();
    }

    private static FileConfig config(Long id, String purpose, boolean master) {
        FileConfig config = new FileConfig();
        config.setId(id);
        config.setPurpose(purpose);
        config.setMaster(master);
        config.setStorage(FileStorageEnum.LOCAL.getStorage());
        return config;
    }

    /** 让 {@code getFileClient(id)} 命中缓存工厂。 */
    private void stubClient(Long id) {
        when(mapper.selectById(id)).thenReturn(config(id, "GENERIC", false));
        when(factory.getFileClient(id)).thenReturn(client);
        when(client.getId()).thenReturn(id);
    }

    // ---------------------------------------------------------------- getByPurpose

    @Test
    void vaultAssetUsesItsOwnConfigWhenPresent() {
        when(mapper.selectList(any())).thenReturn(List.of(config(ID, "VAULT_ASSET", false)));
        stubClient(ID);

        assertSame(client, service.getByPurpose(FileConfigPurpose.VAULT_ASSET));
        verify(mapper, never()).selectOne(any());
    }

    @Test
    void vaultAssetFallsBackToGenericConfigWhenPurposeRowMissing() {
        FileConfig generic = config(ID, "GENERIC", false);
        when(mapper.selectList(any())).thenReturn(List.of(), List.of(generic));
        stubClient(ID);

        assertSame(client, service.getByPurpose(FileConfigPurpose.VAULT_ASSET));
        verify(mapper, never()).selectOne(any());
    }

    @Test
    void vaultAssetFallsBackToMasterWhenNoPurposeRowExistsAtAll() {
        when(mapper.selectList(any())).thenReturn(List.of(), List.of());
        when(mapper.selectOne(any())).thenReturn(config(ID, "GENERIC", true));
        stubClient(ID);

        assertSame(client, service.getByPurpose(FileConfigPurpose.VAULT_ASSET));
    }

    @Test
    void duplicateRowsForTheSamePurposeAreRejectedInsteadOfPickingOne() {
        when(mapper.selectList(any()))
            .thenReturn(List.of(config(1L, "VAULT_ASSET", false), config(2L, "VAULT_ASSET", false)));

        assertThrows(ServiceException.class, () -> service.getByPurpose(FileConfigPurpose.VAULT_ASSET));
        verify(factory, never()).getFileClient(any());
    }

    @Test
    void genericPurposeNeverFallsBackToAnArbitraryConfig() {
        when(mapper.selectList(any())).thenReturn(List.of());

        assertThrows(ServiceException.class, () -> service.getByPurpose(FileConfigPurpose.GENERIC));
        verify(mapper, never()).selectOne(any());
    }

    // ---------------------------------------------------------------- insert

    @Test
    void insertWithoutPurposeStoresGeneric() {
        when(mapper.selectCount(any())).thenReturn(0L);
        when(mapper.insert(any(FileConfig.class))).thenReturn(1);

        service.insertByBo(bo(null));

        ArgumentCaptor<FileConfig> saved = ArgumentCaptor.forClass(FileConfig.class);
        verify(mapper).insert(saved.capture());
        assertEquals("GENERIC", saved.getValue().getPurpose());
        assertEquals(Boolean.FALSE, saved.getValue().getMaster());
    }

    @Test
    void insertKeepsTheRequestedPurpose() {
        when(mapper.selectCount(any())).thenReturn(0L);
        when(mapper.insert(any(FileConfig.class))).thenReturn(1);

        service.insertByBo(bo(FileConfigPurpose.VAULT_ASSET));

        ArgumentCaptor<FileConfig> saved = ArgumentCaptor.forClass(FileConfig.class);
        verify(mapper).insert(saved.capture());
        assertEquals("VAULT_ASSET", saved.getValue().getPurpose());
    }

    @Test
    void insertRejectsASecondConfigForTheSamePurpose() {
        when(mapper.selectCount(any())).thenReturn(1L);

        assertThrows(ServiceException.class, () -> service.insertByBo(bo(FileConfigPurpose.VAULT_ASSET)));
        verify(mapper, never()).insert(any(FileConfig.class));
    }

    // ---------------------------------------------------------------- update

    @Test
    void updateKeepsTheStoredPurposeWhenTheBoOmitsIt() {
        when(mapper.selectById(ID)).thenReturn(config(ID, "VAULT_ASSET", false));
        when(mapper.selectCount(any())).thenReturn(0L);
        when(mapper.updateById(any(FileConfig.class))).thenReturn(1);

        FileConfigBo bo = bo(null);
        bo.setId(ID);
        service.updateByBo(bo);

        ArgumentCaptor<FileConfig> saved = ArgumentCaptor.forClass(FileConfig.class);
        verify(mapper).updateById(saved.capture());
        assertEquals("VAULT_ASSET", saved.getValue().getPurpose());
    }

    @Test
    void editingAConfigDoesNotCountAsADuplicateOfItself() {
        when(mapper.selectById(ID)).thenReturn(config(ID, "VAULT_ASSET", false));
        when(mapper.selectCount(any())).thenReturn(0L);
        when(mapper.updateById(any(FileConfig.class))).thenReturn(1);

        FileConfigBo bo = bo(FileConfigPurpose.VAULT_ASSET);
        bo.setId(ID);

        assertDoesNotThrow(() -> service.updateByBo(bo));
        verify(mapper).updateById(any(FileConfig.class));
    }

    // ---------------------------------------------------------------- switch purpose

    @Test
    void switchMovesThePurposeAndDemotesThePreviousHolderToGeneric() {
        FileConfig target = config(ID, "GENERIC", false);
        FileConfig holder = config(8L, "VAULT_ASSET", false);
        when(mapper.selectById(ID)).thenReturn(target);
        when(mapper.selectList(any())).thenReturn(List.of(holder));
        when(mapper.update(any(), any())).thenReturn(1);

        assertEquals(true, service.updateFileConfigPurpose(ID, FileConfigPurpose.VAULT_ASSET));

        // 两步：旧持有者退回 GENERIC，目标接管用途
        verify(mapper, times(2)).update(any(), any());
        verify(mapper, never()).deleteById(any());
        assertDoesNotThrow(() -> service.updateFileConfigPurpose(ID, FileConfigPurpose.VAULT_ASSET));
    }

    @Test
    void switchWithoutAPreviousHolderOnlyPromotesTheTarget() {
        when(mapper.selectById(ID)).thenReturn(config(ID, "GENERIC", false));
        when(mapper.selectList(any())).thenReturn(List.of());
        when(mapper.update(any(), any())).thenReturn(1);

        assertEquals(true, service.updateFileConfigPurpose(ID, FileConfigPurpose.VAULT_ASSET));
        verify(mapper, times(1)).update(any(), any());
    }

    @Test
    void switchRefusesToTakeThePurposeFromTheMasterConfig() {
        when(mapper.selectById(ID)).thenReturn(config(ID, "GENERIC", false));
        when(mapper.selectList(any())).thenReturn(List.of(config(9L, "VAULT_ASSET", true)));

        assertThrows(ServiceException.class,
            () -> service.updateFileConfigPurpose(ID, FileConfigPurpose.VAULT_ASSET));
        verify(mapper, never()).update(any(), any());
    }

    @Test
    void switchRejectsGenericAsATarget() {
        assertThrows(ServiceException.class,
            () -> service.updateFileConfigPurpose(ID, FileConfigPurpose.GENERIC));
        assertThrows(ServiceException.class,
            () -> service.updateFileConfigPurpose(ID, null));
        verify(mapper, never()).update(any(), any());
    }

    @Test
    void switchRefusesWhenTheTargetAlreadyHasThatPurpose() {
        when(mapper.selectById(ID)).thenReturn(config(ID, "VAULT_ASSET", false));

        assertThrows(ServiceException.class,
            () -> service.updateFileConfigPurpose(ID, FileConfigPurpose.VAULT_ASSET));
        verify(mapper, never()).update(any(), any());
    }

    @Test
    void switchRefusesAForeignConfigAsTarget() {
        when(mapper.selectById(ID)).thenReturn(null);

        assertThrows(ServiceException.class,
            () -> service.updateFileConfigPurpose(ID, FileConfigPurpose.VAULT_ASSET));
        verify(mapper, never()).update(any(), any());
    }

    @Test
    void insertAllowsMultipleGenericConfigs() {
        when(mapper.insert(any(FileConfig.class))).thenReturn(1);

        assertDoesNotThrow(() -> service.insertByBo(bo(FileConfigPurpose.GENERIC)));
        verify(mapper, never()).selectCount(any());
        verify(mapper).insert(any(FileConfig.class));
    }

    @Test
    void switchRefusesToTakeOverFromTargetMasterConfig() {
        when(mapper.selectById(ID)).thenReturn(config(ID, "GENERIC", true));

        assertThrows(ServiceException.class,
            () -> service.updateFileConfigPurpose(ID, FileConfigPurpose.VAULT_ASSET));
        verify(mapper, never()).update(any(), any());
    }

    @Test
    void deleteRefusesMasterAndVaultAssetConfigs() {
        when(mapper.selectByIds(List.of(1L))).thenReturn(List.of(config(1L, "GENERIC", true)));
        assertThrows(ServiceException.class, () -> service.deleteWithValidByIds(List.of(1L), true));

        when(mapper.selectByIds(List.of(2L))).thenReturn(List.of(config(2L, "VAULT_ASSET", false)));
        assertThrows(ServiceException.class, () -> service.deleteWithValidByIds(List.of(2L), true));

        verify(mapper, never()).deleteByIds(any());
    }

    private static FileConfigBo bo(FileConfigPurpose purpose) {
        FileConfigBo bo = new FileConfigBo();
        bo.setName("测试配置");
        bo.setRemark("备注");
        bo.setStorage(FileStorageEnum.LOCAL.getStorage());
        bo.setPurpose(purpose);
        bo.setConfig(Map.of("basePath", "/data/files", "domain", "http://127.0.0.1:8080"));
        return bo;
    }
}
