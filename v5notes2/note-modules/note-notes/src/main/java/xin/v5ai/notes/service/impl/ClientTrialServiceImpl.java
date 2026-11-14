package xin.v5ai.notes.service.impl;

import cn.hutool.core.convert.Convert;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import xin.v5ai.common.core.constant.ClientAccountConstants;
import xin.v5ai.common.core.domain.PageResult;
import xin.v5ai.common.core.enums.UserSource;
import xin.v5ai.common.core.exception.ServiceException;
import xin.v5ai.common.core.utils.MessageUtils;
import xin.v5ai.common.core.utils.StringUtils;
import xin.v5ai.common.mybatis.core.page.PageQuery;
import xin.v5ai.notes.domain.vo.ClientAccountRow;
import xin.v5ai.notes.domain.vo.ClientQuotaVo;
import xin.v5ai.notes.domain.vo.ClientStorageRankVo;
import xin.v5ai.notes.domain.vo.ClientUsageBytesVo;
import xin.v5ai.notes.mapper.ClientUsageMapper;
import xin.v5ai.notes.service.ClientTrialRules;
import xin.v5ai.notes.service.IClientTrialService;
import xin.v5ai.system.service.ISysConfigService;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 试用限制作用于客户端自助获客（{@code client_register} / {@code client_social}）。占用排行包含全部 cli_user。
 */
@Service
@RequiredArgsConstructor
public class ClientTrialServiceImpl implements IClientTrialService {

    private static final int DEFAULT_DAYS = 30;

    private static final long DEFAULT_STORAGE_MB = 20L;

    private static final int MAX_DAYS = 36500;

    private final ClientUsageMapper usageMapper;

    private final ISysConfigService configService;

    @Override
    public void assertCanWrite(Long userId, long additionalBytes) {
        if (userId == null) {
            return;
        }
        ClientAccountRow account = usageMapper.selectAccount(userId);
        if (account == null || !UserSource.isClientSelfServe(account.getUserSource())) {
            return;
        }
        Usage usage = usageOf(userId);
        int days = trialDays();
        long quotaBytes = trialQuotaBytes();
        if (ClientTrialRules.exceeded(account.getCreateTime(), days, usage.used(), additionalBytes, quotaBytes, LocalDateTime.now())) {
            throw new ServiceException(MessageUtils.message("client.trial.expired"));
        }
    }

    @Override
    public ClientQuotaVo quota(Long userId) {
        ClientQuotaVo vo = new ClientQuotaVo();
        if (userId == null) {
            return vo;
        }
        ClientAccountRow account = usageMapper.selectAccount(userId);
        Usage usage = usageOf(userId);
        vo.setNoteBytes(usage.noteBytes());
        vo.setFileBytes(usage.fileBytes());
        vo.setUsedBytes(usage.used());
        int days = trialDays();
        vo.setQuotaBytes(trialQuotaBytes());
        if (account == null || !UserSource.isClientSelfServe(account.getUserSource())) {
            return vo;
        }
        vo.setLimited(true);
        if (account.getCreateTime() != null) {
            vo.setExpireAt(account.getCreateTime().plusDays(days));
        }
        vo.setExpired(ClientTrialRules.exceeded(account.getCreateTime(), days, usage.used(), 0, vo.getQuotaBytes(), LocalDateTime.now()));
        return vo;
    }

    @Override
    public List<ClientStorageRankVo> top(int limit) {
        int size = limit < 1 ? 8 : Math.min(limit, 50);
        Page<ClientStorageRankVo> page = new Page<>(1, size, false);
        usageMapper.selectClientStorageRank(page, null, null);
        return page.getRecords();
    }

    @Override
    public PageResult<ClientStorageRankVo> page(String keyword, String userSource, PageQuery pageQuery) {
        Page<ClientStorageRankVo> page = usageMapper.selectClientStorageRank(
            pageQuery.build(),
            blankToNull(keyword),
            blankToNull(userSource));
        return PageResult.build(page.getRecords(), page.getTotal());
    }

    private static String blankToNull(String value) {
        return StringUtils.isBlank(value) ? null : value.trim();
    }

    @Override
    public long noteBytes(Long noteId) {
        if (noteId == null) {
            return 0L;
        }
        Long bytes = usageMapper.selectNoteBytes(noteId);
        return bytes == null ? 0L : bytes;
    }

    @Override
    public long trashNoteBytes(Long trashId) {
        if (trashId == null) {
            return 0L;
        }
        Long bytes = usageMapper.selectTrashNoteBytes(trashId);
        return bytes == null ? 0L : bytes;
    }

    private Usage usageOf(Long userId) {
        ClientUsageBytesVo usage = usageMapper.selectUserUsage(userId);
        long noteBytes = usage == null || usage.getNoteBytes() == null ? 0L : usage.getNoteBytes();
        long fileBytes = usage == null || usage.getFileBytes() == null ? 0L : usage.getFileBytes();
        return new Usage(noteBytes, fileBytes);
    }

    private int trialDays() {
        String value = configService.selectConfigByKey(ClientAccountConstants.TRIAL_DAYS);
        Integer days = StringUtils.isBlank(value) ? null : Convert.toInt(value, null);
        if (days == null || days < 0) {
            return DEFAULT_DAYS;
        }
        return Math.min(days, MAX_DAYS);
    }

    private long trialQuotaBytes() {
        String value = configService.selectConfigByKey(ClientAccountConstants.TRIAL_STORAGE_MB);
        Long megabytes = StringUtils.isBlank(value) ? null : Convert.toLong(value, null);
        if (megabytes == null || megabytes < 0) {
            megabytes = DEFAULT_STORAGE_MB;
        }
        return megabytes * 1024L * 1024L;
    }

    private record Usage(long noteBytes, long fileBytes) {
        private long used() {
            return noteBytes + fileBytes;
        }
    }
}
