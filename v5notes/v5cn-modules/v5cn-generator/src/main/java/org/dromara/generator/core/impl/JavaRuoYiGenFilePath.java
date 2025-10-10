package org.dromara.generator.core.impl;

import cn.hutool.extra.template.Template;
import cn.hutool.extra.template.TemplateEngine;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.common.core.utils.StringUtils;
import org.dromara.generator.core.GenFilePath;
import org.dromara.generator.domain.GenTable;
import org.dromara.generator.domain.GenTemplate;
import org.springframework.stereotype.Component;

import java.io.StringWriter;
import java.util.Map;

@Slf4j
@RequiredArgsConstructor
@Component("javaRuoYiGenFilePath")
public class JavaRuoYiGenFilePath implements GenFilePath {

    private final TemplateEngine templateEngine;

    /**
     * 项目空间路径
     */
    private static final String PROJECT_PATH = "main/java";

    /**
     * mybatis空间路径
     */
    private static final String MYBATIS_PATH = "main/resources/mapper";


    @Override
    public String filePath(GenTemplate template, GenTable genTable) {

        if(StringUtils.isBlank(template.getFilePath())){
            return "";
        }

        Map<String, Object> contextMap = getContextMap(genTable);

        Template tpl = templateEngine.getTemplate(template.getFilePath());
        StringWriter sw = new StringWriter();
        tpl.render(contextMap, sw);
        return sw.toString();
        // 文件名称
//        String fileName = "";
//        // 包路径
//        String packageName = genTable.getPackageName();
//        // 模块名
//        String moduleName = genTable.getModuleName();
//        // 大写类名
//        String className = genTable.getClassName();
//        // 业务名称
//        String businessName = genTable.getBusinessName();
//
//        String javaPath = PROJECT_PATH + "/" + StringUtils.replace(packageName, ".", "/");
//        String mybatisPath = MYBATIS_PATH + "/" + moduleName;
//        String soybeanModuleName = StrUtil.toSymbolCase(moduleName, '-');
//        if (template.contains("domain.java.vm")) {
//            fileName = StringUtils.format("{}/domain/{}.java", javaPath, className);
//        } else if (template.contains("vo.java.vm")) {
//            fileName = StringUtils.format("{}/domain/vo/{}Vo.java", javaPath, className);
//        } else if (template.contains("bo.java.vm")) {
//            fileName = StringUtils.format("{}/domain/bo/{}Bo.java", javaPath, className);
//        } else if (template.contains("mapper.java.vm")) {
//            fileName = StringUtils.format("{}/mapper/{}Mapper.java", javaPath, className);
//        } else if (template.contains("service.java.vm")) {
//            fileName = StringUtils.format("{}/service/I{}Service.java", javaPath, className);
//        } else if (template.contains("serviceImpl.java.vm")) {
//            fileName = StringUtils.format("{}/service/impl/{}ServiceImpl.java", javaPath, className);
//        } else if (template.contains("controller.java.vm")) {
//            fileName = StringUtils.format("{}/controller/{}Controller.java", javaPath, className);
//        } else if (template.contains("mapper.xml.vm")) {
//            fileName = StringUtils.format("{}/{}Mapper.xml", mybatisPath, className);
//        } else if (template.contains("sql.sql.vm")) {
//            fileName = businessName + "-menu.sql";
//        } else if (template.contains("index.vue.vm")) {
//            fileName = StringUtils.format("views/{}/{}/index.vue", soybeanModuleName, StrUtil.toSymbolCase(businessName, '-'));
//        } else if (template.contains("index-tree.vue.vm")) {
//            fileName = StringUtils.format("views/{}/{}/index.vue", soybeanModuleName, StrUtil.toSymbolCase(businessName, '-'));
//        } else if (template.contains("api.d.ts.vm")) {
//            fileName = StringUtils.format("typings/api/{}.{}.api.d.ts", soybeanModuleName, StrUtil.toSymbolCase(businessName, '-'));
//        } else if (template.contains("api.ts.vm")) {
//            fileName = StringUtils.format("service/api/{}/{}.ts", soybeanModuleName, StrUtil.toSymbolCase(businessName, '-'));
//        } else if (template.contains("search.vue.vm")) {
//            fileName = StringUtils.format("views/{}/{}/modules/{}-search.vue", soybeanModuleName, StrUtil.toSymbolCase(businessName, '-'), StrUtil.toSymbolCase(businessName, '-'));
//        } else if (template.contains("operate-drawer.vue.vm")) {
//            fileName = StringUtils.format("views/{}/{}/modules/{}-operate-drawer.vue", soybeanModuleName, StrUtil.toSymbolCase(businessName, '-'), StrUtil.toSymbolCase(businessName, '-'));
//        }
//        // 其他文件,使用模版名称去掉.vm后缀命名
//        else {
//            String baseFileName = FileNameUtil.getName(template);
//            log.info("基本文件名称===>>：{}", baseFileName);
//            fileName = StringUtils.format("{}",baseFileName.replace(".vm", ""));
//        }
//        log.info("生成文件：{}，<==>模板名称：{}，<==>表名称：{}", fileName, template, genTable.getTableName());
//        return fileName;
    }
}
