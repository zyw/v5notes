package xin.v5ai.notes.service.impl;

import cn.dev33.satoken.stp.StpUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import xin.v5ai.common.core.constant.CacheNames;
import xin.v5ai.common.core.utils.StringUtils;
import xin.v5ai.common.core.utils.ThreadUtils;
import xin.v5ai.common.redis.utils.RedisUtils;
import xin.v5ai.notes.domain.vo.dashboard.DashboardDirVo;
import xin.v5ai.notes.domain.vo.dashboard.DashboardKpiVo;
import xin.v5ai.notes.domain.vo.dashboard.DashboardNameValueVo;
import xin.v5ai.notes.domain.vo.dashboard.DashboardOverviewVo;
import xin.v5ai.notes.domain.vo.dashboard.DashboardRecentNoteVo;
import xin.v5ai.notes.domain.vo.dashboard.DashboardStorageVo;
import xin.v5ai.notes.domain.vo.dashboard.DashboardSystemVo;
import xin.v5ai.notes.domain.vo.dashboard.DashboardTrendVo;
import xin.v5ai.notes.mapper.NoteDashboardMapper;
import xin.v5ai.notes.service.INoteDashboardService;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 首页聚合统计服务实现
 * <p>
 * 聚合策略：
 * <ul>
 *   <li>对外 {@link #overview(Integer)} 负责组装各区块，任一区块抛异常只把它降级为空 + 相应 KPI 置 0，
 *       整体始终返回 200，绝不让首页 500。</li>
 *   <li>Service 方法加上 {@link Cacheable}（项目为 Redisson + Caffeine 两级，TTL 通过
 *       {@code cacheNames} 的 {@code #60s} 段声明），key 含 range，同 range 60 秒内只重算一次。</li>
 * </ul>
 *
 * @author v5notes2
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class NoteDashboardServiceImpl implements INoteDashboardService {

    /**
     * 业务时区（与 JDBC serverTimezone=GMT%2B8 对齐）
     */
    private static final ZoneId ZONE = ZoneId.of("Asia/Shanghai");

    /**
     * LocalDateTime → ISO-8601 带偏移（Asia/Shanghai）。
     * <p>
     * 统一在这里转字符串，让被 {@code @Cacheable} 缓存的 VO 不含 java.time 类型，
     * 避免 Redisson Jackson 编解码器回读时反序列化失败。
     */
    private static String toIso(LocalDateTime time) {
        return time == null ? null : time.atZone(ZONE).toOffsetDateTime().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME);
    }

    /**
     * 合法的 range 取值
     */
    private static final int[] ALLOWED_RANGES = {7, 30, 90};

    /**
     * 目录 Top N
     */
    private static final int DIR_TOP = 8;

    /**
     * 最近笔记条数
     */
    private static final int RECENT_LIMIT = 6;

    private final NoteDashboardMapper dashboardMapper;

    @Override
    @Cacheable(
        cacheNames = CacheNames.NOTES_DASHBOARD,
        key = "'overview:' + #range"
    )
    public DashboardOverviewVo overview(Integer range) {
        long started = System.currentTimeMillis();
        List<String> degraded = new ArrayList<>();
        int finalRange = normalizeRange(range);
        LocalDate today = LocalDate.now(ZONE);
        LocalDateTime tomorrowStart = today.plusDays(1).atStartOfDay();

        DashboardOverviewVo vo = new DashboardOverviewVo();
        vo.setRange(finalRange);
        vo.setGeneratedAt(toIso(LocalDateTime.now(ZONE)));

        DashboardSystemVo sys = new DashboardSystemVo();
        vo.setSystem(sys);
        vo.setKpi(new DashboardKpiVo());
        vo.setTrend(new ArrayList<>());
        vo.setDirTop(new ArrayList<>());
        vo.setDevice(new ArrayList<>());
        vo.setStorage(new ArrayList<>());
        vo.setRecentNotes(new ArrayList<>());

        safe("kpi", sys, degraded, () -> buildKpi(vo, sys, today, tomorrowStart));
        safe("trend", sys, degraded, () -> buildTrend(vo, finalRange, today, tomorrowStart));
        safe("dirTop", sys, degraded, () -> buildDirTop(vo, today, tomorrowStart));
        safe("device", sys, degraded, () -> buildDevice(vo, today, tomorrowStart));
        safe("storage", sys, degraded, () -> buildStorage(vo));
        safe("recent", sys, degraded, () -> buildRecent(vo));

        if (log.isDebugEnabled()) {
            log.debug("首页聚合完成 range={} degraded={} 耗时={}ms", range, degraded, System.currentTimeMillis() - started);
        }
        return vo;
    }

    /**
     * range 归一化：只接受 7 / 30 / 90，其余一律按 30 处理
     */
    private int normalizeRange(Integer range) {
        if (range == null) {
            return 30;
        }
        for (int r : ALLOWED_RANGES) {
            if (r == range) {
                return r;
            }
        }
        return 30;
    }

    /**
     * 区块容错：执行 supplier，抛异常时打印日志并把该区块 key 记入降级清单，KPI 区块整体归零。
     */
    private void safe(String key, DashboardSystemVo sys, List<String> degraded, Runnable task) {
        try {
            task.run();
        } catch (Exception e) {
            log.error("首页区块 [{}] 计算失败，已降级为空", key, e);
            degraded.add(key);
            if ("kpi".equals(key)) {
                // KPI 区块整体失败：把 kpi 与 system 重置为全 0，避免返回半成品（buildKpi 只在校验通过后写值）
                sys.setSuccessRate(0.0);
                sys.setP95ms(0L);
                sys.setOnline(0L);
                sys.setOperlogToday(0L);
                sys.setCacheHit(0.0);
            }
        }
    }

    private void buildKpi(DashboardOverviewVo vo, DashboardSystemVo sys, LocalDate today, LocalDateTime tomorrowStart) {
        LocalDate d7Date = today.minusDays(6);
        LocalDateTime d7 = d7Date.atStartOfDay();
        LocalDateTime weekStart = today.minusDays(today.getDayOfWeek().getValue() - 1L).atStartOfDay();

        // 全部指标先在局部对象上计算，全部成功后再统一写回，保证任一查询失败时 kpi 保持全 0
        DashboardKpiVo kpi = new DashboardKpiVo();
        long online = countOnline();
        Long loginsToday = dashboardMapper.selectLoginCount(today.atStartOfDay(), tomorrowStart);
        Long editToday = dashboardMapper.selectEditCount(today.atStartOfDay(), tomorrowStart);

        // 并行执行其余互不依赖的查询
        List<Object> res = ThreadUtils.virtualSubmitAll(
            () -> dashboardMapper.selectNoteStat(d7, today.atStartOfDay()),
            () -> dashboardMapper.selectDirStat(),
            () -> dashboardMapper.selectUserStat(weekStart),
            () -> dashboardMapper.selectActiveUserCount(d7, tomorrowStart),
            () -> dashboardMapper.selectFileStat(),
            () -> dashboardMapper.selectOperLogCount(today.atStartOfDay(), tomorrowStart),
            () -> dashboardMapper.selectOperLogSuccessRate(today.atStartOfDay(), tomorrowStart),
            () -> dashboardMapper.selectOperLogP95(today.atStartOfDay(), tomorrowStart)
        );
        DashboardKpiVo note = (DashboardKpiVo) res.get(0);
        DashboardKpiVo dir = (DashboardKpiVo) res.get(1);
        DashboardKpiVo user = (DashboardKpiVo) res.get(2);
        Long activeUsers = (Long) res.get(3);
        DashboardKpiVo file = (DashboardKpiVo) res.get(4);
        Long operlogToday = (Long) res.get(5);
        Double successRate = (Double) res.get(6);
        Long p95 = (Long) res.get(7);

        // 规模
        long notes = val(note, DashboardKpiVo::getNotes);
        kpi.setNotes(notes);
        kpi.setNotesDelta7d(val(note, DashboardKpiVo::getNotesDelta7d));
        kpi.setNotesToday(val(note, DashboardKpiVo::getNotesToday));
        long delta = kpi.getNotesDelta7d();
        long base = notes - delta;
        kpi.setNotesDeltaPct(base > 0 ? round1(delta / (double) base * 100.0) : 0.0);

        // 目录
        kpi.setDirs(val(dir, DashboardKpiVo::getDirs));
        kpi.setEmptyDirs(val(dir, DashboardKpiVo::getEmptyDirs));

        // 编辑（今日）
        kpi.setEditsToday(editToday == null ? 0L : editToday);

        // 用户
        kpi.setUsers(val(user, DashboardKpiVo::getUsers));
        kpi.setUsersNewWeek(val(user, DashboardKpiVo::getUsersNewWeek));
        kpi.setActiveUsers7d(activeUsers == null ? 0L : activeUsers);

        // 在线 / 登录
        kpi.setOnline(online);
        kpi.setLoginsToday(loginsToday == null ? 0L : loginsToday);

        // 文件（size 为 Double）
        kpi.setFiles(val(file, DashboardKpiVo::getFiles));
        kpi.setStorageGB(valD(file, DashboardKpiVo::getStorageGB));
        kpi.setAvgFileMB(valD(file, DashboardKpiVo::getAvgFileMB));

        // 系统脉搏读数
        double sr = successRate == null ? 0.0 : round2(successRate);
        kpi.setSuccessRate(sr);
        kpi.setP95ms(p95 == null ? 0L : p95);
        kpi.setOperlogToday(operlogToday == null ? 0L : operlogToday);
        double cacheHit = queryCacheHit();
        kpi.setCacheHit(cacheHit);

        // 全部指标就绪后统一写回
        vo.setKpi(kpi);
        sys.setSuccessRate(sr);
        sys.setP95ms(p95 == null ? 0L : p95);
        sys.setOnline(online);
        sys.setOperlogToday(operlogToday == null ? 0L : operlogToday);
        sys.setCacheHit(cacheHit);
    }

    private void buildTrend(DashboardOverviewVo vo, int range, LocalDate today, LocalDateTime tomorrowStart) {
        LocalDateTime from = today.minusDays(range - 1L).atStartOfDay();
        List<DashboardTrendVo> rows = dashboardMapper.selectTrend(from, tomorrowStart);
        Map<LocalDate, DashboardTrendVo> map = new HashMap<>();
        if (rows != null) {
            DateTimeFormatter ymd = DateTimeFormatter.ofPattern("yyyy-MM-dd");
            for (DashboardTrendVo row : rows) {
                map.put(LocalDate.parse(row.getDate(), ymd), row);
            }
        }
        DateTimeFormatter md = DateTimeFormatter.ofPattern("MM/dd");
        List<DashboardTrendVo> trend = new ArrayList<>(range);
        for (int i = range - 1; i >= 0; i--) {
            LocalDate d = today.minusDays(i);
            DashboardTrendVo row = map.get(d);
            if (row == null) {
                row = new DashboardTrendVo();
            }
            row.setDate(d.format(md));
            if (row.getCreated() == null) {
                row.setCreated(0);
            }
            if (row.getEdited() == null) {
                row.setEdited(0);
            }
            trend.add(row);
        }
        vo.setTrend(trend);
    }

    private void buildDirTop(DashboardOverviewVo vo, LocalDate today, LocalDateTime tomorrowStart) {
        LocalDateTime d7 = today.minusDays(6).atStartOfDay();
        List<DashboardDirVo> all = dashboardMapper.selectDirDistribution(d7);
        long total = all == null ? 0 : all.stream().mapToLong(DashboardDirVo::getNotes).sum();
        List<DashboardDirVo> top;
        if (all == null || all.isEmpty()) {
            top = new ArrayList<>();
        } else if (all.size() <= DIR_TOP) {
            top = new ArrayList<>(all);
        } else {
            top = new ArrayList<>(all.subList(0, DIR_TOP));
            long topSum = top.stream().mapToLong(DashboardDirVo::getNotes).sum();
            long topActive = top.stream().mapToLong(DashboardDirVo::getActive7d).sum();
            long activeTotal = all.stream().mapToLong(DashboardDirVo::getActive7d).sum();
            DashboardDirVo other = new DashboardDirVo();
            other.setName("其他目录");
            other.setNotes(total - topSum);
            other.setActive7d(activeTotal - topActive);
            top.add(other);
        }
        vo.setDirTop(top);
    }

    private void buildDevice(DashboardOverviewVo vo, LocalDate today, LocalDateTime tomorrowStart) {
        LocalDateTime d7 = today.minusDays(6).atStartOfDay();
        List<DashboardNameValueVo> list = dashboardMapper.selectDeviceDistribution(d7, tomorrowStart);
        vo.setDevice(list == null ? new ArrayList<>() : list);
    }

    private void buildStorage(DashboardOverviewVo vo) {
        List<DashboardStorageVo> list = dashboardMapper.selectStorageDistribution();
        if (list == null || list.isEmpty()) {
            vo.setStorage(new ArrayList<>());
            return;
        }
        // 数据守恒：整数之和 = kpi.files，地板分摊后补差保证 size 之和 = kpi.storageGB
        List<DashboardStorageVo> out = new ArrayList<>(list.size());
        long countSum = 0;
        long sizeSum = 0;
        for (DashboardStorageVo row : list) {
            long c = row.getCount() == null ? 0L : row.getCount();
            double s = row.getSize() == null ? 0.0 : row.getSize();
            long rounded = (long) Math.floor(round1(s) * 10.0);
            DashboardStorageVo item = new DashboardStorageVo();
            item.setName(row.getName());
            item.setSize(rounded / 10.0);
            item.setCount(c);
            out.add(item);
            countSum += c;
            sizeSum += rounded;
        }
        // 用未取整的真实容量补差（避免加零误差），再用向下取整对齐一位小数
        double rawTotal = list.stream().mapToDouble(r -> r.getSize() == null ? 0.0 : r.getSize()).sum();
        long totalTenths = (long) Math.floor(round1(rawTotal) * 10.0);
        long diff = totalTenths - sizeSum;
        if (diff != 0) {
            int idx = 0;
            while (diff != 0 && idx < out.size()) {
                DashboardStorageVo row = out.get(idx);
                long adjusted = (long) Math.floor(round1(row.getSize()) * 10.0) + diff;
                row.setSize(adjusted / 10.0);
                diff = 0;
                idx++;
            }
        }
        // 移除 count 为 0 的无效大类，避免环形图出现内容为空的扇区
        out.removeIf(r -> r.getCount() == 0L);
        vo.setStorage(out);
    }

    private void buildRecent(DashboardOverviewVo vo) {
        List<DashboardRecentNoteVo> list = dashboardMapper.selectRecentNotes(RECENT_LIMIT);
        vo.setRecentNotes(list == null ? new ArrayList<>() : list);
    }

    /**
     * 当前在线会话数（Sa-Token 有效 token），失败时返回 0
     */
    private long countOnline() {
        try {
            java.util.Collection<String> keys = RedisUtils.keys(CacheNames.ONLINE_TOKEN_KEY + "*");
            long count = 0;
            for (String key : keys) {
                String token = StringUtils.substringAfterLast(key, StringUtils.COLON);
                if (StpUtil.stpLogic.getTokenActiveTimeoutByToken(token) >= -1) {
                    count++;
                }
            }
            return count;
        } catch (Exception e) {
            log.error("首页在线人数统计失败，降级为 0", e);
            return 0L;
        }
    }

    /**
     * 缓存命中率（%）：Redis INFO stats 的 keyspace_hits/(hits+misses)，失败时返回 0
     */
    private double queryCacheHit() {
        // 待确认 #7：Redisson 4.8 未暴露 keyspace hits/misses 的编程接口（无 INFO / getNodesGroup），
        // 本期先降级为 0，前端隐藏该项；后续可接 Micrometer / Redis INFO 命令补充。
        return 0.0;
    }

    private static long val(DashboardKpiVo k, java.util.function.Function<DashboardKpiVo, Long> fn) {
        if (k == null) {
            return 0L;
        }
        Long v = fn.apply(k);
        return v == null ? 0L : v;
    }

    private static double valD(DashboardKpiVo k, java.util.function.Function<DashboardKpiVo, Double> fn) {
        if (k == null) {
            return 0.0;
        }
        Double v = fn.apply(k);
        return v == null ? 0.0 : v;
    }

    private static double round1(double v) {
        return Math.round(v * 10.0) / 10.0;
    }

    private static double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }
}