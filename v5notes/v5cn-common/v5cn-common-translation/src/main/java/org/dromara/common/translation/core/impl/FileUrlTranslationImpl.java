package org.dromara.common.translation.core.impl;

import org.dromara.common.core.service.FileService;
import org.dromara.common.translation.annotation.TranslationType;
import org.dromara.common.translation.constant.TransConstant;
import org.dromara.common.translation.core.TranslationInterface;
import lombok.AllArgsConstructor;

/**
 * OSS翻译实现
 *
 * @author Lion Li
 */
@AllArgsConstructor
@TranslationType(type = TransConstant.FILE_ID_TO_URL)
public class FileUrlTranslationImpl implements TranslationInterface<String> {

    private final FileService fileService;

    @Override
    public String translation(Object key, String other) {
        if (key instanceof String ids) {
            return fileService.selectUrlByIds(ids);
        } else if (key instanceof Long id) {
            return fileService.selectUrlByIds(id.toString());
        }
        return null;
    }
}
