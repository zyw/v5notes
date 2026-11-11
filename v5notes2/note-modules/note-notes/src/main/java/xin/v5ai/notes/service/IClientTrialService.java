package xin.v5ai.notes.service;

import xin.v5ai.common.core.domain.PageResult;
import xin.v5ai.common.core.service.ClientStorageGuard;
import xin.v5ai.common.mybatis.core.page.PageQuery;
import xin.v5ai.notes.domain.vo.ClientQuotaVo;
import xin.v5ai.notes.domain.vo.ClientStorageRankVo;

import java.util.List;

/**
 * 客户端自助注册用户的试用限制，以及全部客户端用户的占用空间。
 */
public interface IClientTrialService extends ClientStorageGuard {

    /**
     * 当前用户的试用额度。非客户端注册用户 limited 为 false。
     *
     * @param userId 用户 ID
     * @return 额度
     */
    ClientQuotaVo quota(Long userId);

    /**
     * 占用空间最高的客户端用户。
     *
     * @param limit 条数
     * @return 排行
     */
    List<ClientStorageRankVo> top(int limit);

    /**
     * 全部客户端用户，按占用空间从大到小。
     *
     * @param keyword    用户账号或昵称，模糊匹配；空则不限
     * @param userSource 用户来源，精确匹配；空则不限
     * @param pageQuery  分页
     * @return 分页结果
     */
    PageResult<ClientStorageRankVo> page(String keyword, String userSource, PageQuery pageQuery);

    /**
     * 笔记正文字节，用于恢复回收站笔记前估算新增占用。
     *
     * @param noteId 笔记 ID
     * @return 字节数
     */
    long noteBytes(Long noteId);

    /**
     * 回收站记录下待恢复笔记的正文字节合计。
     *
     * @param trashId 回收站记录 ID
     * @return 字节数
     */
    long trashNoteBytes(Long trashId);
}
