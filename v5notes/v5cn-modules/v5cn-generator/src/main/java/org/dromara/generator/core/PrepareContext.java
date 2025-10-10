package org.dromara.generator.core;

import cn.hutool.core.util.StrUtil;
import org.dromara.common.core.utils.DateUtils;
import org.dromara.common.core.utils.StringUtils;
import org.dromara.generator.constant.GenConstants;
import org.dromara.generator.domain.GenTable;
import org.dromara.generator.util.VelocityUtils;

import java.util.Map;

/**
 * 添加模版上下文项
 */
public interface PrepareContext {
    /**
     * 添加模版上下文项
     *
     * @param contextMap Velocity上下文
     * @param table           表信息
     */
    void addContextItems(Map<String,Object> contextMap, GenTable table);

    /**
     * 添加更多上下文项
     */
    default void addPrepareContextItems(Map<String,Object> contextMap, GenTable genTable) {
        String moduleName = genTable.getModuleName();
        String businessName = genTable.getBusinessName();
        String packageName = genTable.getPackageName();
        String tplCategory = genTable.getTplCategory();
        String functionName = genTable.getFunctionName();

        // 使用的模板（crud单表操作 tree树表操作 sub主子表操作）
        contextMap.put("tplCategory", genTable.getTplCategory());
        contextMap.put("tableName", genTable.getTableName());
        contextMap.put("functionName", StringUtils.isNotEmpty(functionName) ? functionName : "【请填写功能名称】");
        contextMap.put("ClassName", genTable.getClassName());
        contextMap.put("className", StringUtils.uncapitalize(genTable.getClassName()));
        // 模块名, 例如：system, 多个单词使用-连接，例如：system-tool
        contextMap.put("moduleName", StrUtil.toSymbolCase(genTable.getModuleName(), '-'));
        // 业务名, 例如：SysUser
        contextMap.put("BusinessName", StringUtils.capitalize(genTable.getBusinessName()));
        // 业务名驼峰命名格式，例如：sysUser
        contextMap.put("businessName", genTable.getBusinessName());
        // 业务名下划线命名格式，例如：sys_user
        contextMap.put("business_name", StrUtil.toUnderlineCase(genTable.getBusinessName()));
        // 业务名中横线命名格式，例如：sys-user
        contextMap.put("business__name", StrUtil.toSymbolCase(genTable.getBusinessName(), '-'));
        // 业务名称 中空格命名格式，例如：Sys User
        contextMap.put("businessname", StrUtil.toSymbolCase(genTable.getBusinessName(), ' '));
        // 提取包名前缀，如：xin.v5ai.system.tool -> xin.v5ai.system
        contextMap.put("basePackage", VelocityUtils.getPackagePrefix(packageName));
        contextMap.put("packageName", packageName);
        contextMap.put("author", genTable.getFunctionAuthor());
        contextMap.put("datetime", DateUtils.getDate());
        // 主键列信息
        contextMap.put("pkColumn", genTable.getPkColumn());
        // 权限前缀，例如：system:user，适用与Java 权限控制
        contextMap.put("permissionPrefix", VelocityUtils.getPermissionPrefix(moduleName, businessName));
        contextMap.put("dicts", VelocityUtils.getDicts(genTable));
        contextMap.put("dictList", VelocityUtils.getDictList(genTable));
        contextMap.put("columns", genTable.getColumns());
        contextMap.put("table", genTable);
        contextMap.put("StrUtil", new StrUtil());
        // 菜单上下文项
        VelocityUtils.setMenuVelocityContext(contextMap, genTable);
        // 添加更多上下文项
        addContextItems(contextMap, genTable);
        // 树结构相关上下文项
        if (GenConstants.TPL_CATEGORY.TPL_TREE.equals(tplCategory)) {
            VelocityUtils.setTreeVelocityContext(contextMap, genTable);
        }
    }
}
