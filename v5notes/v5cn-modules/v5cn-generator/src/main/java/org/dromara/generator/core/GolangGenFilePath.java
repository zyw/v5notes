package org.dromara.generator.core;

import cn.hutool.core.io.file.FileNameUtil;
import cn.hutool.core.util.StrUtil;
import lombok.extern.slf4j.Slf4j;
import org.dromara.common.core.utils.StringUtils;
import org.dromara.generator.domain.GenTable;
import org.springframework.stereotype.Component;

@Slf4j
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

        if (template.contains("services.go.vm")) {
            filePath = StringUtils.format("{}/services/{}.go", BACKEND_PATH, tableName);
        } else if (template.contains("services-export.go")) {
            filePath = StringUtils.format("{}/services/export.go", BACKEND_PATH);
        }
        // 控制器
        else if (template.contains("controller.go.vm")) {
            filePath = StringUtils.format("{}/controller/{}.go", BACKEND_PATH, tableName);
        } else if (template.contains("controller-export.go.vm"))  {
            filePath = StringUtils.format("{}/controller/export.go", BACKEND_PATH);
        } else if (template.contains("controller-import.go.vm"))  {
            filePath = StringUtils.format("{}/controller/import.go", BACKEND_PATH);
        }
        // 模型
        else if (template.contains("models")) {
            filePath = StringUtils.format("{}/models/{}.go", BACKEND_PATH, tableName);
        } else if (template.contains("request")) {
            filePath = StringUtils.format("{}/models/request/{}.go", BACKEND_PATH, tableName);
        } else if(template.contains("response")) {
            filePath = StringUtils.format("{}/models/response/{}.go", BACKEND_PATH, tableName);
        }
        // 路由
        else if (template.contains("router.go.vm")) {
            filePath = StringUtils.format("{}/router/{}.go", BACKEND_PATH, tableName);
        } else if (template.contains("router-export.go.vm")) {
            filePath = StringUtils.format("{}/router/export.go", BACKEND_PATH);
        } else if (template.contains("router-import.go.vm")) {
            filePath = StringUtils.format("{}/router/import.go", BACKEND_PATH);
        }
        // 前端页面
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
        // sql 文件
        else if (template.contains("sql.sql.vm")) {
            filePath = StringUtils.format(businessName + "-menu.sql");
        }
        // 其他文件,使用模版名称去掉.vm后缀命名
        else {
            String baseFileName = FileNameUtil.getName(template);
            log.info("基本文件名称===>>：{}", baseFileName);
            filePath = StringUtils.format("{}",baseFileName.replace(".vm", ""));
        }
        log.info("生成文件：{}，<==>模板名称：{}，<==>表名称：{}", filePath, template, genTable.getTableName());
        return filePath;
    }
}
