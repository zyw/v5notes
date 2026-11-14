<script setup lang="ts">
/**
 * Phase 0 placeholder. Phase 1 will wire create / open / default vault actions.
 */
</script>

<template>
  <section class="panel welcome" aria-labelledby="welcome-title">
    <p class="eyebrow">PHASE 0</p>
    <h1 id="welcome-title">欢迎使用 V5Notes Vault</h1>
    <p class="lede">
      本地文件夹是权威；笔记正文是库内的 <code>.md</code>。Cloud 笔记与 Vault 库默认不是同一份数据。
    </p>
    <ul class="actions" aria-label="即将支持的开库方式">
      <li>
        <button type="button" class="primary" disabled title="Phase 1">创建新库</button>
        <span>选择父目录并命名（即将到来）</span>
      </li>
      <li>
        <button type="button" class="ghost" disabled title="Phase 1">打开已有库</button>
        <span>选择已有 Vault 根目录（即将到来）</span>
      </li>
      <li>
        <button type="button" class="ghost" disabled title="Phase 1">使用默认库</button>
        <span>应用数据目录内的默认库（即将到来）</span>
      </li>
    </ul>
    <p class="hint">请勿把库放进网盘同步目录后再开官方 Sync。</p>
  </section>
</template>
