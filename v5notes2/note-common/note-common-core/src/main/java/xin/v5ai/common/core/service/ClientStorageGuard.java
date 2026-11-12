package xin.v5ai.common.core.service;

/**
 * 客户端自助注册用户的写入限制。文件模块只依赖这个接口，避免反过来依赖笔记模块。
 */
public interface ClientStorageGuard {

    /**
     * 试用期已过或试用空间不足时拒绝本次写入。
     *
     * @param userId          占用空间所属用户
     * @param additionalBytes 本次新增字节，删除或缩小内容时传 0
     */
    void assertCanWrite(Long userId, long additionalBytes);
}
