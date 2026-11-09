import { createApp, h, ref } from 'vue'
import { V5Editor } from '@v5md/vue'
import '@v5md/view/theme.css'
import './styles/style.css'

const content = ref('# 标题\n\n第一段文字。\n\n## 二级标题\n\n第二段文字。\n')
createApp({
  setup() {
    return () => h('div', { class: 'v5md-host', style: 'padding:24px' }, [
      h(V5Editor, { modelValue: content.value, 'onUpdate:modelValue': (value: string) => (content.value = value) }),
    ])
  },
}).mount('#app')
