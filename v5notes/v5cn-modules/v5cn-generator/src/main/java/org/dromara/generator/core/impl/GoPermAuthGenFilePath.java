package org.dromara.generator.core.impl;

import cn.hutool.extra.template.Template;
import cn.hutool.extra.template.TemplateEngine;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.generator.core.GenFilePath;
import org.dromara.generator.domain.GenTable;
import org.dromara.generator.domain.GenTemplate;
import org.springframework.stereotype.Component;

import java.io.StringWriter;
import java.util.Map;

@Slf4j
@RequiredArgsConstructor
@Component("goPermAuthGenFilePath")
public class GoPermAuthGenFilePath implements GenFilePath {

    private final TemplateEngine templateEngine;

    /**
     * 项目空间路径
     */
    private static final String BACKEND_PATH = "server";
    /**
     * golang空间路径
     */
    private static final String GOLANG_PATH = "web";


    @Override
    public String filePath(GenTemplate template, GenTable genTable) {
        // 文件名称
//        String filePath = "";
        // 包路径
        Map<String, Object> contextMap = getContextMap(genTable);

        Template tpl = templateEngine.getTemplate(template.getFilePath());
        StringWriter sw = new StringWriter();
        tpl.render(contextMap, sw);
        return sw.toString();

//        String soybeanModuleName = StrUtil.toSymbolCase(moduleName, '-');
//
//        if (template.contains("services.go.vm")) {
//            filePath = StringUtils.format("{}/services/{}.go", template.getFilePath(), tableName);
//        } else if (template.contains("services-export.go")) {
//            filePath = StringUtils.format("{}/services/export.go", template.getFilePath());
//        }
//        // 控制器
//        else if (template.contains("controller.go.vm")) {
//            filePath = StringUtils.format("{}/controller/{}.go", template.getFilePath(), tableName);
//        } else if (template.contains("controller-export.go.vm"))  {
//            filePath = StringUtils.format("{}/controller/export.go", template.getFilePath());
//        } else if (template.contains("controller-import.go.vm"))  {
//            filePath = StringUtils.format("{}/controller/import.go", template.getFilePath());
//        }
//        // 模型
//        else if (template.contains("models")) {
//            filePath = StringUtils.format("{}/models/{}.go", template.getFilePath(), tableName);
//        } else if (template.contains("request")) {
//            filePath = StringUtils.format("{}/models/request/{}.go", template.getFilePath(), tableName);
//        } else if(template.contains("response")) {
//            filePath = StringUtils.format("{}/models/response/{}.go", template.getFilePath(), tableName);
//        }
//        // 路由
//        else if (template.contains("router.go.vm")) {
//            filePath = StringUtils.format("{}/router/{}.go", template.getFilePath(), tableName);
//        } else if (template.contains("router-export.go.vm")) {
//            filePath = StringUtils.format("{}/router/export.go", template.getFilePath());
//        } else if (template.contains("router-import.go.vm")) {
//            filePath = StringUtils.format("{}/router/import.go", template.getFilePath());
//        }
//        // 前端页面
//        else if (template.contains("index.vue.vm")) {
//            filePath = StringUtils.format("{}/views/{}/{}/index.vue", template.getFilePath(), soybeanModuleName, StrUtil.toSymbolCase(businessName, '-'));
//        } else if (template.contains("index-tree.vue.vm")) {
//            filePath = StringUtils.format("{}/views/{}/{}/index.vue", template.getFilePath(), soybeanModuleName, StrUtil.toSymbolCase(businessName, '-'));
//        } else if (template.contains("api.d.ts.vm")) {
//            filePath = StringUtils.format("{}/typings/api/{}.{}.api.d.ts", template.getFilePath(), soybeanModuleName, StrUtil.toSymbolCase(businessName, '-'));
//        } else if (template.contains("api.ts.vm")) {
//            filePath = StringUtils.format("{}/service/api/{}/{}.ts", template.getFilePath(), soybeanModuleName, StrUtil.toSymbolCase(businessName, '-'));
//        } else if (template.contains("search.vue.vm")) {
//            filePath = StringUtils.format("{}/views/{}/{}/modules/{}-search.vue", template.getFilePath(), soybeanModuleName, StrUtil.toSymbolCase(businessName, '-'), StrUtil.toSymbolCase(businessName, '-'));
//        } else if (template.contains("operate-drawer.vue.vm")) {
//            filePath = StringUtils.format("{}/views/{}/{}/modules/{}-operate-drawer.vue", template.getFilePath(), soybeanModuleName, StrUtil.toSymbolCase(businessName, '-'), StrUtil.toSymbolCase(businessName, '-'));
//        }
//        // sql 文件
//        else if (template.contains("sql.sql.vm")) {
//            filePath = StringUtils.format(businessName + "-menu.sql");
//        }
//        // 其他文件,使用模版名称去掉.vm后缀命名
//        else {
//            String baseFileName = FileNameUtil.getName(template.getFileName());
//            log.info("基本文件名称===>>：{}", baseFileName);
//            filePath = StringUtils.format("{}",baseFileName.replace(".vm", ""));
//        }
//        log.info("生成文件：{}，<==>模板名称：{}，<==>表名称：{}", filePath, template, genTable.getTableName());
//        return filePath;
    }
}
