package org.dromara.generator.core;

import cn.hutool.core.util.StrUtil;
import org.dromara.common.core.utils.StringUtils;
import org.dromara.generator.domain.GenTable;
import org.springframework.stereotype.Component;

@Component("golangGenFilePath")
public class GolangGenFilePath implements GenFilePath {
    /**
     * 项目空间路径
     */
    private static final String BACKEND_PATH = "server";
    /**
     * golang空间路径
     */
    private static final String GOLANG_PATH = "web";
    @Override
    public String filePath(String template, GenTable genTable) {
        // 文件名称
        String filePath = "";
        // 包路径
        String packageName = genTable.getPackageName();
        // 模块名
        String moduleName = genTable.getModuleName();
        // 大写类名
        String tableName = genTable.getTableName();
        // 业务名称
        String businessName = genTable.getBusinessName();

        String soybeanModuleName = StrUtil.toSymbolCase(moduleName, '-');

        if (template.contains("services")) {
            filePath = StringUtils.format("{}/services/{}.go", BACKEND_PATH, tableName);
        } else if (template.contains("controller")) {
            filePath = StringUtils.format("{}/controller/{}.go", BACKEND_PATH, tableName);
        } else if (template.contains("models")) {
            filePath = StringUtils.format("{}/models/{}.go", BACKEND_PATH, tableName);
        } else if (template.contains("router")) {
            filePath = StringUtils.format("{}/router/{}.go", BACKEND_PATH, tableName);
        } else if (template.contains("request")) {
            filePath = StringUtils.format("{}/request/{}.go", BACKEND_PATH, tableName);
        } else if(template.contains("response")) {
            filePath = StringUtils.format("{}/response/{}.go", BACKEND_PATH, tableName);
        }
        else if (template.contains("index.vue.vm")) {
            filePath = StringUtils.format("{}/views/{}/{}/index.vue", GOLANG_PATH, soybeanModuleName, StrUtil.toSymbolCase(businessName, '-'));
        } else if (template.contains("index-tree.vue.vm")) {
            filePath = StringUtils.format("{}/views/{}/{}/index.vue", GOLANG_PATH, soybeanModuleName, StrUtil.toSymbolCase(businessName, '-'));
        } else if (template.contains("api.d.ts.vm")) {
            filePath = StringUtils.format("{}/typings/api/{}.{}.api.d.ts", GOLANG_PATH, soybeanModuleName, StrUtil.toSymbolCase(businessName, '-'));
        } else if (template.contains("api.ts.vm")) {
            filePath = StringUtils.format("{}/service/api/{}/{}.ts", GOLANG_PATH, soybeanModuleName, StrUtil.toSymbolCase(businessName, '-'));
        } else if (template.contains("search.vue.vm")) {
            filePath = StringUtils.format("{}/views/{}/{}/modules/{}-search.vue", GOLANG_PATH, soybeanModuleName, StrUtil.toSymbolCase(businessName, '-'), StrUtil.toSymbolCase(businessName, '-'));
        } else if (template.contains("operate-drawer.vue.vm")) {
            filePath = StringUtils.format("{}/views/{}/{}/modules/{}-operate-drawer.vue", GOLANG_PATH, soybeanModuleName, StrUtil.toSymbolCase(businessName, '-'), StrUtil.toSymbolCase(businessName, '-'));
        }
        return filePath;
    }
}
