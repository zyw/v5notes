package org.dromara.generator.util;

import cn.hutool.core.collection.CollUtil;
import cn.hutool.core.convert.Convert;
import cn.hutool.core.lang.Dict;
import cn.hutool.core.util.StrUtil;
import com.google.common.collect.Sets;
import lombok.AccessLevel;
import lombok.NoArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.velocity.VelocityContext;
import org.dromara.common.core.exception.ServiceException;
import org.dromara.common.core.utils.SpringUtils;
import org.dromara.common.core.utils.StringUtils;
import org.dromara.common.json.utils.JsonUtils;
import org.dromara.common.mybatis.enums.DataBaseType;
import org.dromara.common.mybatis.helper.DataBaseHelper;
import org.dromara.generator.constant.GenConstants;
import org.dromara.generator.core.GenFilePath;
import org.dromara.generator.core.PrepareContext;
import org.dromara.generator.domain.GenTable;
import org.dromara.generator.domain.GenTableColumn;
import org.dromara.generator.domain.GenTemplate;
import org.dromara.generator.service.IGenTemplateService;
import org.springframework.context.ApplicationContext;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.core.io.support.ResourcePatternResolver;

import java.io.IOException;
import java.net.URL;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 模板处理工具类
 *
 * @author ruoyi
 */
@Slf4j
@NoArgsConstructor(access = AccessLevel.PRIVATE)
public class VelocityUtils {
    /**
     * 默认上级菜单，系统工具
     */
    private static final String DEFAULT_PARENT_MENU_ID = "3";

    /**
     * 设置模板变量信息
     *
     * @return 模板列表
     */
    public static VelocityContext prepareContext(GenTable genTable) {
        // 处理模板变量，为不同后端类型添加不同的变量
        PrepareContext prepareContext = SpringUtils.getBean(genTable.getBeType() + "PrepareContext");
        VelocityContext velocityContext = new VelocityContext();

        if (prepareContext == null) {
            log.error("未找到{}的PrepareContext", genTable.getBeType());
            throw new ServiceException("未找到" + genTable.getBeType() + "的PrepareContext");
        }

        prepareContext.addPrepareContextItems(velocityContext, genTable);

        return velocityContext;
    }

    public static void setMenuVelocityContext(VelocityContext context, GenTable genTable) {
        String options = genTable.getOptions();
        Dict paramsObj = JsonUtils.parseMap(options);
        String parentMenuId = getParentMenuId(paramsObj);
        context.put("parentMenuId", parentMenuId);
    }

    public static void setTreeVelocityContext(VelocityContext context, GenTable genTable) {
        String options = genTable.getOptions();
        Dict paramsObj = JsonUtils.parseMap(options);
        String treeCode = getTreecode(paramsObj);
        String treeParentCode = getTreeParentCode(paramsObj);
        String treeName = getTreeName(paramsObj);

        context.put("treeCode", treeCode);
        context.put("treeParentCode", treeParentCode);
        context.put("treeName", treeName);
        context.put("expandColumn", getExpandColumn(genTable));
        if (paramsObj.containsKey(GenConstants.TREE_PARENT_CODE)) {
            context.put("tree_parent_code", paramsObj.get(GenConstants.TREE_PARENT_CODE));
        }
        if (paramsObj.containsKey(GenConstants.TREE_NAME)) {
            context.put("tree_name", paramsObj.get(GenConstants.TREE_NAME));
        }
    }

    /**
     * 获取模板信息
     * @param tplCategory 模板类别
     * @param beType 后端类型
     * @param feType 前端类型
     *
     * @return 模板列表
     */
    public static List<GenTemplate> getTemplateList(String tplCategory,String beType,String feType) {

        IGenTemplateService genTemplateService = SpringUtils.getBean(IGenTemplateService.class);

        List<GenTemplate> genTemplateList = genTemplateService.getTemplateList(List.of(beType,feType));

        if (CollUtil.isEmpty(genTemplateList)) {
            log.error("未找到模版信息，后端类型：{}，前端类型：{}", beType, feType);
            throw new ServiceException("未找到模版信息，后端类型：" + beType + "，前端类型：" + feType);
        }
        // 添加SQL模板
        DataBaseType dataBaseType = DataBaseHelper.getDataBaseType();
        genTemplateList = genTemplateList.stream().filter((template) -> {
            if(StrUtil.isBlank(template.getTpCategory())){
                return true;
            }
            if(StrUtil.equalsAny(template.getTpCategory(), GenConstants.TPL_CATEGORY.TPL_CRUD, GenConstants.TPL_CATEGORY.TPL_TREE)) {
                if (GenConstants.TPL_CATEGORY.TPL_CRUD.equals(tplCategory)){
                    return !template.getTpCategory().equals(GenConstants.TPL_CATEGORY.TPL_TREE);
                } else if (GenConstants.TPL_CATEGORY.TPL_TREE.equals(tplCategory)){
                    return !template.getTpCategory().equals(GenConstants.TPL_CATEGORY.TPL_CRUD);
                }
            }

            return template.getTpCategory().equals(dataBaseType.getCategory());
        }).collect(Collectors.toList());

        return genTemplateList;
        /*// 后端模板列表
        String beUri = "vm/backend/" + beType;
        Set<String> beTemplateList = getResourcesTemplateList(beUri);
        // 前端模板列表
        String feUri = "vm/frontend/" + feType;
        Set<String> feTemplateList = getResourcesTemplateList(feUri);

        if (GenConstants.TPL_CATEGORY.TPL_CRUD.equals(tplCategory)) {
            feTemplateList.remove(feUri + "/index-tree.vue.vm");
            feTemplateList.add(feUri + "/index.vue.vm");
        } else if (GenConstants.TPL_CATEGORY.TPL_TREE.equals(tplCategory)) {
            feTemplateList.remove(feUri + "/index.vue.vm");
            feTemplateList.add(feUri + "/index-tree.vue.vm");
        }
        // 模板列表合并
        List<String> templates = new ArrayList<>(beTemplateList);
        templates.addAll(feTemplateList);

        // 添加SQL模板
//        DataBaseType dataBaseType = DataBaseHelper.getDataBaseType();
        String sqlTemplatePath = "vm/sql/" + beType;
        if (dataBaseType.isOracle()) {
            templates.add(sqlTemplatePath + "/oracle/sql.sql.vm");
        } else if (dataBaseType.isPostgreSql()) {
            templates.add(sqlTemplatePath + "/postgres/sql.sql.vm");
        } else if (dataBaseType.isSqlServer()) {
            templates.add(sqlTemplatePath + "/sqlserver/sql.sql.vm");
        } else {
            templates.add(sqlTemplatePath + "/sql.sql.vm");
        }

        log.info("全部模版列表==>>:{}", templates);

        return templates;*/
    }

    /**
     * 获取文件名
     */
    public static String getFileName(String template, GenTable genTable) {
        GenFilePath genFilePath = SpringUtils.getBean(genTable.getBeType() + "GenFilePath");
        return genFilePath.filePath(template, genTable);
    }

    /**
     * 获取包前缀
     *
     * @param packageName 包名称
     * @return 包前缀名称
     */
    public static String getPackagePrefix(String packageName) {
        int lastIndex = packageName.lastIndexOf(".");
        return StringUtils.substring(packageName, 0, lastIndex);
    }

    /**
     * 根据列类型获取字典组
     *
     * @param genTable 业务表对象
     * @return 返回字典组
     */
    public static String getDicts(GenTable genTable) {
        List<GenTableColumn> columns = genTable.getColumns();
        Set<String> dicts = new HashSet<>();
        addDicts(dicts, columns);
        return StringUtils.join(dicts, ", ");
    }

    /**
     * 添加字典列表
     *
     * @param dicts   字典列表
     * @param columns 列集合
     */
    public static void addDicts(Set<String> dicts, List<GenTableColumn> columns) {
        for (GenTableColumn column : columns) {
            if (!column.isSuperColumn() && StringUtils.isNotEmpty(column.getDictType()) && StringUtils.equalsAny(
                column.getHtmlType(),
                new String[]{
                    GenConstants.HTML_TYPE.HTML_SELECT,
                    GenConstants.HTML_TYPE.HTML_RADIO,
                    GenConstants.HTML_TYPE.HTML_CHECKBOX})) {
                dicts.add("'" + column.getDictType() + "'");
            }
        }
    }

    /**
     * 根据列类型获取字典组
     *
     * @param genTable 业务表对象
     * @return 返回字典组
     */
    public static Set<Map<String, Object>> getDictList(GenTable genTable) {
        List<GenTableColumn> columns = genTable.getColumns();
        Set<Map<String, Object>> dicts = new HashSet<>();
        addDictList(dicts, columns);
        return dicts;
    }

    /**
     * 添加字典列表
     *
     * @param dicts   字典列表
     * @param columns 列集合
     */
    public static void addDictList(Set<Map<String, Object>> dicts, List<GenTableColumn> columns) {
        for (GenTableColumn column : columns) {
            if (!column.isSuperColumn() && StringUtils.isNotEmpty(column.getDictType()) && StringUtils.equalsAny(
                column.getHtmlType(),
                new String[]{ GenConstants.HTML_TYPE.HTML_SELECT,
                    GenConstants.HTML_TYPE.HTML_RADIO,
                    GenConstants.HTML_TYPE.HTML_CHECKBOX})) {
                Map<String, Object> dict = new HashMap<>();
                dict.put("type", column.getDictType());
                dict.put("name", StringUtils.toCamelCase(column.getDictType()));
                dict.put("immediate", !column.isList());
                dicts.add(dict);
            }
        }
    }

    /**
     * 获取权限前缀
     *
     * @param moduleName   模块名称
     * @param businessName 业务名称
     * @return 返回权限前缀
     */
    public static String getPermissionPrefix(String moduleName, String businessName) {
        return StringUtils.format("{}:{}", moduleName, businessName);
    }

    /**
     * 获取上级菜单ID字段
     *
     * @param paramsObj 生成其他选项
     * @return 上级菜单ID字段
     */
    public static String getParentMenuId(Dict paramsObj) {
        if (CollUtil.isNotEmpty(paramsObj) && paramsObj.containsKey(GenConstants.PARENT_MENU_ID)
            && StringUtils.isNotEmpty(paramsObj.getStr(GenConstants.PARENT_MENU_ID))) {
            return paramsObj.getStr(GenConstants.PARENT_MENU_ID);
        }
        return DEFAULT_PARENT_MENU_ID;
    }

    /**
     * 获取树编码
     *
     * @param paramsObj 生成其他选项
     * @return 树编码
     */
    public static String getTreecode(Map<String, Object> paramsObj) {
        if (CollUtil.isNotEmpty(paramsObj) && paramsObj.containsKey(GenConstants.TREE_CODE)) {
            return StringUtils.toCamelCase(Convert.toStr(paramsObj.get(GenConstants.TREE_CODE)));
        }
        return StringUtils.EMPTY;
    }

    /**
     * 获取树父编码
     *
     * @param paramsObj 生成其他选项
     * @return 树父编码
     */
    public static String getTreeParentCode(Dict paramsObj) {
        if (CollUtil.isNotEmpty(paramsObj) && paramsObj.containsKey(GenConstants.TREE_PARENT_CODE)) {
            return StringUtils.toCamelCase(paramsObj.getStr(GenConstants.TREE_PARENT_CODE));
        }
        return StringUtils.EMPTY;
    }

    /**
     * 获取树名称
     *
     * @param paramsObj 生成其他选项
     * @return 树名称
     */
    public static String getTreeName(Dict paramsObj) {
        if (CollUtil.isNotEmpty(paramsObj) && paramsObj.containsKey(GenConstants.TREE_NAME)) {
            return StringUtils.toCamelCase(paramsObj.getStr(GenConstants.TREE_NAME));
        }
        return StringUtils.EMPTY;
    }

    /**
     * 获取需要在哪一列上面显示展开按钮
     *
     * @param genTable 业务表对象
     * @return 展开按钮列序号
     */
    public static int getExpandColumn(GenTable genTable) {
        String options = genTable.getOptions();
        Dict paramsObj = JsonUtils.parseMap(options);
        String treeName = paramsObj.getStr(GenConstants.TREE_NAME);
        int num = 0;
        for (GenTableColumn column : genTable.getColumns()) {
            if (column.isList()) {
                num++;
                String columnName = column.getColumnName();
                if (columnName.equals(treeName)) {
                    break;
                }
            }
        }
        return num;
    }

    /**
     * 获取资源文件模板列表
     * @param path 模板路径
     * @return 模板列表
     */
    private static Set<String> getResourcesTemplateList(String path) {
        Set<String> templates = Sets.newHashSet();
        ApplicationContext resolver = SpringUtils.getApplicationContext();
        try {
            // 使用PathMatchingResourcePatternResolver
            ResourcePatternResolver resourcePatternResolver = new PathMatchingResourcePatternResolver(resolver);
            Resource[] resources = resourcePatternResolver.getResources(
                ResourcePatternResolver.CLASSPATH_URL_PREFIX + path + "/**/*.vm");

            for (Resource resource : resources) {
                if (!resource.exists()) {
                    continue;
                }
                String resourcePath = getResourcePath(resource);
                String relativePath = extractVmRelativePath(resourcePath);
                if (relativePath != null) {
                    templates.add(relativePath);
                }
            }
        } catch (IOException e) {
            log.error("获取目录下的全部模板失败：{}", e.getMessage(),e);
            throw new ServiceException("获取目录下的全部模板失败");
        }

        return templates;
    }

    /**
     * 获取资源的路径（兼容JAR包和文件系统）
     */
    private static String getResourcePath(Resource resource) throws IOException {
        URL url = resource.getURL();
        String urlString = url.toString();

        // 处理JAR包中的资源
        if (urlString.contains("!/")) {
            // 提取JAR包内的路径
            return urlString.substring(urlString.indexOf("!/") + 2);
        } else {
            // 文件系统中的资源
            return resource.getFile().getAbsolutePath();
        }
    }

    /**
     * 提取vm目录之后的路径
     * @param fullPath 全路径
     * @return 提取后的路径
     */
    private static String extractVmRelativePath(String fullPath) {
        // 统一路径分隔符
        String normalizedPath = fullPath.replace('\\', '/');

        // 查找"vm/"在路径中的位置
        int vmIndex = normalizedPath.indexOf("vm/");
        if (vmIndex != -1) {
            return normalizedPath.substring(vmIndex);
        }

        // 如果直接以vm开头（没有斜杠）
        if (normalizedPath.startsWith("vm/")) {
            return normalizedPath;
        }

        return null;
    }
}
