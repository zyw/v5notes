package xin.v5ai.vault.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import xin.v5ai.vault.domain.VaultFile;

public interface VaultFileMapper extends BaseMapper<VaultFile> {

    /**
     * Reads only the text body of one file.
     *
     * <p>{@code content} is marked {@code select = false} on the entity, so the generic selects
     * never carry it. The single read that genuinely needs the body asks for it explicitly here,
     * which keeps manifest pages and file-type lookups free of note bodies.</p>
     */
    @Select("SELECT content FROM vault_file WHERE id = #{id}")
    String selectContentById(@Param("id") Long id);
}
