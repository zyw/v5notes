package org.dromara.generator.core;

import cn.hutool.core.util.StrUtil;
import org.dromara.common.core.utils.StringUtils;
import org.dromara.generator.domain.GenTable;
import org.springframework.stereotype.Component;

@Component("javaGenFilePath")
public class JavaGenFilePath implements GenFilePath {

    /**
     * 项目空间路径
     */
    private static final String PROJECT_PATH = "main/java";

    /**
     * mybatis空间路径
     */
    private static final String MYBATIS_PATH = "main/resources/mapper";


    @Override
    public String filePath(String template, GenTable genTable) {
        // 文件名称
        String fileName = "";
        // 包路径
        String packageName = genTable.getPackageName();
        // 模块名
        String moduleName = genTable.getModuleName();
        // 大写类名
        String className = genTable.getClassName();
        // 业务名称
        String businessName = genTable.getBusinessName();

        String javaPath = PROJECT_PATH + "/" + StringUtils.replace(packageName, ".", "/");
        String mybatisPath = MYBATIS_PATH + "/" + moduleName;
        String soybeanPath = "soy";
        String soybeanModuleName = StrUtil.toSymbolCase(moduleName, '-');
        if (template.contains("domain.java.vm")) {
            fileName = StringUtils.format("{}/domain/{}.java", javaPath, className);
        }
        if (template.contains("vo.java.vm")) {
            fileName = StringUtils.format("{}/domain/vo/{}Vo.java", javaPath, className);
        }
        if (template.contains("bo.java.vm")) {
            fileName = StringUtils.format("{}/domain/bo/{}Bo.java", javaPath, className);
        }
        if (template.contains("mapper.java.vm")) {
            fileName = StringUtils.format("{}/mapper/{}Mapper.java", javaPath, className);
        } else if (template.contains("service.java.vm")) {
            fileName = StringUtils.format("{}/service/I{}Service.java", javaPath, className);
        } else if (template.contains("serviceImpl.java.vm")) {
            fileName = StringUtils.format("{}/service/impl/{}ServiceImpl.java", javaPath, className);
        } else if (template.contains("controller.java.vm")) {
            fileName = StringUtils.format("{}/controller/{}Controller.java", javaPath, className);
        } else if (template.contains("mapper.xml.vm")) {
            fileName = StringUtils.format("{}/{}Mapper.xml", mybatisPath, className);
        } else if (template.contains("sql.sql.vm")) {
            fileName = businessName + "menu.sql";
        } else if (template.contains("index.vue.vm")) {
            fileName = StringUtils.format("{}/views/{}/{}/index.vue", soybeanPath, soybeanModuleName, StrUtil.toSymbolCase(businessName, '-'));
        } else if (template.contains("index-tree.vue.vm")) {
            fileName = StringUtils.format("{}/views/{}/{}/index.vue", soybeanPath, soybeanModuleName, StrUtil.toSymbolCase(businessName, '-'));
        } else if (template.contains("api.d.ts.vm")) {
            fileName = StringUtils.format("{}/typings/api/{}.{}.api.d.ts", soybeanPath, soybeanModuleName, StrUtil.toSymbolCase(businessName, '-'));
        } else if (template.contains("api.ts.vm")) {
            fileName = StringUtils.format("{}/service/api/{}/{}.ts", soybeanPath, soybeanModuleName, StrUtil.toSymbolCase(businessName, '-'));
        } else if (template.contains("search.vue.vm")) {
            fileName = StringUtils.format("{}/views/{}/{}/modules/{}-search.vue", soybeanPath, soybeanModuleName, StrUtil.toSymbolCase(businessName, '-'), StrUtil.toSymbolCase(businessName, '-'));
        } else if (template.contains("operate-drawer.vue.vm")) {
            fileName = StringUtils.format("{}/views/{}/{}/modules/{}-operate-drawer.vue", soybeanPath, soybeanModuleName, StrUtil.toSymbolCase(businessName, '-'), StrUtil.toSymbolCase(businessName, '-'));
        }
        // 其他文件,使用模版名称去掉.vm后缀命名
        else {
            fileName = StringUtils.format("",template.replace(".vm", ""));
        }
        return fileName;
    }
}
