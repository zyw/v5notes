<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { invoke, isTauri } from '@tauri-apps/api/core'
import { isHttpLink, parseReleaseNotes } from '../models/releaseNotes'

const { t } = useI18n()
const props = defineProps<{ source: string }>()
const blocks = computed(() => parseReleaseNotes(props.source))

async function openLink(href: string): Promise<void> {
  if (!isHttpLink(href) || !isTauri()) return
  await invoke('open_external_url', { url: href })
}
</script>

<template>
  <div class="update-notes">
    <p v-if="blocks.length === 0">{{ t('update.emptyNotes') }}</p>
    <template v-for="(block, index) in blocks" :key="index">
      <h3 v-if="block.kind === 'heading'">
        <template v-for="(inline, inlineIndex) in block.inlines" :key="inlineIndex">
          <code v-if="inline.kind === 'code'">{{ inline.text }}</code>
          <a v-else-if="inline.kind === 'link'" :href="inline.href" @click.prevent="openLink(inline.href)">{{ inline.text }}</a>
          <template v-else>{{ inline.text }}</template>
        </template>
      </h3>
      <p v-else-if="block.kind === 'paragraph'">
        <template v-for="(inline, inlineIndex) in block.inlines" :key="inlineIndex">
          <code v-if="inline.kind === 'code'">{{ inline.text }}</code>
          <a v-else-if="inline.kind === 'link'" :href="inline.href" @click.prevent="openLink(inline.href)">{{ inline.text }}</a>
          <template v-else>{{ inline.text }}</template>
        </template>
      </p>
      <ul v-else>
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
