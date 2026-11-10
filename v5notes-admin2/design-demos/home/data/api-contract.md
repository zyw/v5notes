# 首页聚合接口契约（前后端共同遵守）

`GET /notes/dashboard/overview?range=30`

- 鉴权：登录即可（首页对所有人可见，**不加** `@SaCheckPermission`）
- 返回：`R<DashboardOverviewVo>`，即 `{ code:200, msg:'操作成功', data: {...} }`
- 缓存：Service 层 60s 本地/Redis 缓存，key 含 range
- range 取值：7 / 30 / 90，默认 30；超出范围按 30 处理

## data 结构（必须与 `data/mock-data.json` 一一对应）

```jsonc
{
  "range": 30,
  "generatedAt": "2026-11-07T10:24:00+08:00",   // ISO-8601，前端显示"数据截至"
  "kpi": {
    "notes": 12486,            // 笔记总数（del_flag='0'）
    "notesDelta7d": 412,       // 近 7 天新增
    "notesDeltaPct": 3.4,      // 近 7 天新增 / 期初存量 × 100，保留 1 位
    "dirs": 328,               // 目录总数
    "emptyDirs": 12,           // 空目录数
    "notesToday": 86,          // 今日新增
    "editsToday": 1842,        // 今日编辑次数（sys_oper_log，title='笔记'，business_type=2）
    "users": 1284,             // 用户总数
    "usersNewWeek": 26,        // 近 7 天新增用户
    "activeUsers7d": 486,      // 近 7 天有编辑行为的去重用户
    "online": 42,              // 当前在线会话数
    "loginsToday": 312,        // 今日登录次数
    "files": 3612,             // 文件数
    "storageGB": 18.6,         // 总容量 GB，保留 1 位
    "avgFileMB": 5.3,          // 平均单文件 MB，保留 1 位
    "successRate": 99.97,      // 24h 成功率（%）
    "p95ms": 86,               // 24h P95 响应 ms
    "cacheHit": 96.4,          // 缓存命中率（%）
    "operlogToday": 2418       // 今日操作日志条数
  },
  "trend": [                   // 长度 = range，按日期升序，最后一项是今天
    { "date": "10/09", "created": 52, "edited": 1324 }
  ],
  "dirTop": [                  // 笔记数最多的 8 个目录 + 一条"其他目录"兜底，合计必须 = kpi.notes
    { "name": "产品设计", "notes": 1862, "active7d": 214 }
  ],
  "device": [                  // 近 7 天登录次数按客户端构成
    { "name": "PC 客户端", "value": 1486 },
    { "name": "App 客户端", "value": 698 }
  ],
  "storage": [                 // 附件按类型构成，size 单位 GB，合计 = kpi.storageGB
    { "name": "图片", "size": 9.8, "count": 1986 }
  ],
  "recentNotes": [             // 最近更新 6 条
    { "id": "1849657043265904641", "name": "Q4 产品路线图评审纪要", "dirName": "产品设计",
      "authorName": "林知远", "chars": 2480, "updatedAt": "2026-11-07T10:22:00+08:00" }
  ],
  "system": {
    "successRate": 99.97,
    "p95ms": 86,
    "cacheHit": 96.4,
    "online": 42,
    "operlogToday": 2418
  }
}
```

## 约定

1. **雪花 ID 一律字符串**（笔记 id）——项目已全局约定，前端不做 Number 转换。
2. 时间为 ISO-8601 带时区；前端负责格式化成"2 分钟前"。
3. `dirTop` / `storage` 要保证合计守恒，否则环形图和占比会错。
4. 任一区块查询失败不应让整个接口 500：**降级为空数组 + 该区块 kpi 置 0**，前端显示空态。
5. 无数据（新装环境）时也要返回完整结构，不要返回 null 字段。
