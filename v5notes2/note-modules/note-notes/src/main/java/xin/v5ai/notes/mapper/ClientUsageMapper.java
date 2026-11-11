package xin.v5ai.notes.mapper;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.apache.ibatis.annotations.Param;
import xin.v5ai.notes.domain.vo.ClientAccountRow;
import xin.v5ai.notes.domain.vo.ClientStorageRankVo;
import xin.v5ai.notes.domain.vo.ClientUsageBytesVo;

/**
 * 客户端用户占用空间。手写 SQL 需要自己带上 del_flag。
 */
public interface ClientUsageMapper {

    /**
     * 读取用户来源和创建时间。
     *
     * @param userId 用户 ID
     * @return 不存在时为 null
     */
    ClientAccountRow selectAccount(@Param("userId") Long userId);

    /**
     * 当前未删除笔记和文件的字节数。
     *
     * @param userId 用户 ID
     * @return 笔记字节与文件字节
     */
    ClientUsageBytesVo selectUserUsage(@Param("userId") Long userId);

    /**
     * 一篇笔记正文的字节数，包含回收站中的笔记。
     *
     * @param noteId 笔记 ID
     * @return 字节数，笔记不存在时为 0
     */
    Long selectNoteBytes(@Param("noteId") Long noteId);

    /**
     * 某个回收站记录下尚未恢复的笔记正文字节合计。
     *
     * @param trashId 回收站记录 ID
     * @return 字节数
     */
    Long selectTrashNoteBytes(@Param("trashId") Long trashId);

    /**
     * 全部客户端用户按占用空间倒序。分页由分页插件追加。
     *
     * @param page       分页
     * @param keyword    用户账号或昵称，模糊匹配；空则不限
     * @param userSource 用户来源，精确匹配；空则不限
     * @return 当前页
     */
    Page<ClientStorageRankVo> selectClientStorageRank(Page<ClientStorageRankVo> page,
                                                      @Param("keyword") String keyword,
                                                      @Param("userSource") String userSource);
}
