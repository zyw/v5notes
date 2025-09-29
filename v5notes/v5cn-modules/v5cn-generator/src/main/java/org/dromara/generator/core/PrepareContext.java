package org.dromara.generator.core;

import cn.hutool.core.util.StrUtil;
import org.apache.velocity.VelocityContext;
import org.dromara.common.core.utils.DateUtils;
import org.dromara.common.core.utils.StringUtils;
import org.dromara.generator.constant.GenConstants;
import org.dromara.generator.domain.GenTable;
import org.dromara.generator.util.VelocityUtils;

/**
 * 添加模版上下文项
 */
public interface PrepareContext {
    /**
     * 添加模版上下文项
     *
     * @param velocityContext Velocity上下文
     * @param table           表信息
     */
    void addContextItems(VelocityContext velocityContext, GenTable table);

    /**
     * 添加更多上下文项
     */
    default void addPrepareContextItems(VelocityContext velocityContext, GenTable genTable) {
        String moduleName = genTable.getModuleName();
        String businessName = genTable.getBusinessName();
        String packageName = genTable.getPackageName();
        String tplCategory = genTable.getTplCategory();
        String functionName = genTable.getFunctionName();

        // 使用的模板（crud单表操作 tree树表操作 sub主子表操作）
        velocityContext.put("tplCategory", genTable.getTplCategory());
        velocityContext.put("tableName", genTable.getTableName());
        velocityContext.put("functionName", StringUtils.isNotEmpty(functionName) ? functionName : "【请填写功能名称】");
        velocityContext.put("ClassName", genTable.getClassName());
        velocityContext.put("className", StringUtils.uncapitalize(genTable.getClassName()));
        // 模块名, 例如：system, 多个单词使用-连接，例如：system-tool
        velocityContext.put("moduleName", StrUtil.toSymbolCase(genTable.getModuleName(), '-'));
        // 业务名, 例如：SysUser
        velocityContext.put("BusinessName", StringUtils.capitalize(genTable.getBusinessName()));
        // 业务名驼峰命名格式，例如：sysUser
        velocityContext.put("businessName", genTable.getBusinessName());
        // 业务名下划线命名格式，例如：sys_user
        velocityContext.put("business_name", StrUtil.toUnderlineCase(genTable.getBusinessName()));
        // 业务名中横线命名格式，例如：sys-user
        velocityContext.put("business__name", StrUtil.toSymbolCase(genTable.getBusinessName(), '-'));
        // 业务名称 中空格命名格式，例如：Sys User
        velocityContext.put("businessname", StrUtil.toSymbolCase(genTable.getBusinessName(), ' '));
        // 提取包名前缀，如：xin.v5ai.system.tool -> xin.v5ai.system
        velocityContext.put("basePackage", VelocityUtils.getPackagePrefix(packageName));
        velocityContext.put("packageName", packageName);
        velocityContext.put("author", genTable.getFunctionAuthor());
        velocityContext.put("datetime", DateUtils.getDate());
        // 主键列信息
        velocityContext.put("pkColumn", genTable.getPkColumn());
        // 权限前缀，例如：system:user，适用与Java 权限控制
        velocityContext.put("permissionPrefix", VelocityUtils.getPermissionPrefix(moduleName, businessName));
        velocityContext.put("dicts", VelocityUtils.getDicts(genTable));
        velocityContext.put("dictList", VelocityUtils.getDictList(genTable));
        velocityContext.put("columns", genTable.getColumns());
        velocityContext.put("table", genTable);
        velocityContext.put("StrUtil", new StrUtil());
        // 菜单上下文项
        VelocityUtils.setMenuVelocityContext(velocityContext, genTable);
        // 添加更多上下文项
        addContextItems(velocityContext, genTable);
        // 树结构相关上下文项
        if (GenConstants.TPL_CATEGORY.TPL_TREE.equals(tplCategory)) {
            VelocityUtils.setTreeVelocityContext(velocityContext, genTable);
        }
    }
}
