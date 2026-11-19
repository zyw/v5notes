<script setup lang="ts">
import { computed } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { isHttpLink, parseReleaseNotes } from '../update/releaseNotes'

/** 更新说明来自远端清单：只渲染由解析器产出的纯文本、代码与 http(s) 链接。 */
const props = defineProps<{ source: string }>()
const blocks = computed(() => parseReleaseNotes(props.source))

async function openLink(href: string): Promise<void> {
  if (!isHttpLink(href)) return
  try {
    await invoke('open_external_url', { url: href })
  } catch {
    // 打不开链接不影响阅读说明。
  }
}
</script>

<template>
  <div class="release-notes">
    <p v-if="blocks.length === 0" class="release-notes-empty">这个版本没有更新说明。</p>
    <template v-for="(block, index) in blocks" :key="index">
      <p v-if="block.kind === 'heading'" class="release-notes-heading" :class="'is-h' + block.level">
        <template v-for="(inline, inlineIndex) in block.inlines" :key="inlineIndex">
          <code v-if="inline.kind === 'code'">{{ inline.text }}</code>
          <a v-else-if="inline.kind === 'link'" :href="inline.href" @click.prevent="openLink(inline.href)">{{ inline.text }}</a>
          <template v-else>{{ inline.text }}</template>
        </template>
      </p>
      <p v-else-if="block.kind === 'paragraph'" class="release-notes-paragraph">
        <template v-for="(inline, inlineIndex) in block.inlines" :key="inlineIndex">
          <code v-if="inline.kind === 'code'">{{ inline.text }}</code>
          <a v-else-if="inline.kind === 'link'" :href="inline.href" @click.prevent="openLink(inline.href)">{{ inline.text }}</a>
          <template v-else>{{ inline.text }}</template>
        </template>
      </p>
      <ul v-else class="release-notes-list">
        <li v-for="(item, itemIndex) in block.items" :key="itemIndex">
          <template v-for="(inline, inlineIndex) in item" :key="inlineIndex">
            <code v-if="inline.kind === 'code'">{{ inline.text }}</code>
            <a v-else-if="inline.kind === 'link'" :href="inline.href" @click.prevent="openLink(inline.href)">{{ inline.text }}</a>
            <template v-else>{{ inline.text }}</template>
          </template>
        </li>
      </ul>
    </template>
  </div>
</template>

<style scoped>
.release-notes {
  max-height: 260px;
  overflow: auto;
  padding: 12px 14px;
  border: 1px solid color-mix(in srgb, var(--line) 92%, transparent);
  border-radius: 9px;
  background: color-mix(in srgb, var(--panel) 72%, var(--surface));
  font-family: var(--font-ui);
  font-size: 0.82rem;
  line-height: 1.65;
  color: var(--ink);
  overscroll-behavior: contain;
}

.release-notes-empty,
.release-notes-paragraph {
  margin: 0;
  color: var(--muted);
}
.release-notes-paragraph {
  color: var(--ink);
}
.release-notes > * + * {
  margin-top: 8px;
}

.release-notes-heading {
  margin: 0;
  font-weight: 600;
}
.release-notes-heading.is-h1 {
  font-size: 0.9rem;
}
.release-notes-heading.is-h2,
.release-notes-heading.is-h3 {
  font-size: 0.84rem;
}

.release-notes-list {
  margin: 0;
  padding-left: 18px;
  display: grid;
  gap: 3px;
}

.release-notes code {
  padding: 1px 4px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--ink) 6%, transparent);
  font-family: var(--font-mono);
  font-size: 0.74rem;
}

.release-notes a {
  color: var(--accent);
  text-decoration: underline;
  text-underline-offset: 2px;
}
</style>
