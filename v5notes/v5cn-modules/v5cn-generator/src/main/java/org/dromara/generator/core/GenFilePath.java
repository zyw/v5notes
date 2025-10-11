package org.dromara.generator.core;

import cn.hutool.core.util.StrUtil;
import com.google.common.collect.Maps;
import org.dromara.common.core.utils.StringUtils;
import org.dromara.generator.domain.GenTable;
import org.dromara.generator.domain.GenTemplate;

import java.util.Map;

/**
 * 生成zip包中的文件路径
 *
 * @author wind
 */
public interface GenFilePath {
    /**
     * 根据模板文件生成文件路径
     *
     * @param template 模板
     * @param genTable 业务表
     * @return 路径
     */
    String filePath(GenTemplate template, GenTable genTable);

    /**
     * 获取上下文
     *
     * @param genTable 业务表
     * @return 上下文
     */
    default Map<String, Object> getContextMap(GenTable genTable) {
        String packageName = genTable.getPackageName();
        // 模块名
        String moduleName = genTable.getModuleName();
        // 大写类名
        String tableName = genTable.getTableName();
        String ClassName = genTable.getClassName();
        String className = StringUtils.uncapitalize(genTable.getClassName());
        // 业务名称
        String businessName = genTable.getBusinessName();

        Map<String, Object> contextMap = Maps.newHashMap();
        contextMap.put("packageName", packageName);
        // 包路径, 例如：org/dromara/system
        contextMap.put("pkPath", StringUtils.replace(packageName, ".", "/"));
        contextMap.put("ClassName", ClassName);
        contextMap.put("className", className);
        contextMap.put("tableName", tableName);
        // 模块名, 例如：system, 多个单词使用-连接，例如：system-tool
        contextMap.put("moduleName", StrUtil.toSymbolCase(moduleName, '-'));
        // 业务名, 例如：SysUser
        contextMap.put("BusinessName", StringUtils.capitalize(businessName));
        // 业务名驼峰命名格式，例如：sysUser
        contextMap.put("businessName", businessName);
        // 业务名下划线命名格式，例如：sys_user
        contextMap.put("business_name", StrUtil.toUnderlineCase(businessName));
        // 业务名中横线命名格式，例如：sys-user
        contextMap.put("business__name", StrUtil.toSymbolCase(businessName, '-'));
        return contextMap;
    }
}
