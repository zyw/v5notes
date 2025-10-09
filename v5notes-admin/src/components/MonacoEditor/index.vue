<template>
  <div ref="eitorRef" class="editor" :style="'width: 100%; height: ' + props.height + 'px'"></div>
</template>

<script setup>
import { onMounted, ref, watch, toRaw } from 'vue';
import { formatJson } from '@/utils/common';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import 'monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution';
import 'monaco-editor/esm/vs/basic-languages/freemarker2/freemarker2.contribution';
import 'monaco-editor/esm/vs/basic-languages/html/html.contribution';
import 'monaco-editor/esm/vs/basic-languages/css/css.contribution';
import 'monaco-editor/esm/vs/editor/contrib/find/browser/findController';

const props = defineProps({
  modelValue: {
    type: [String, Object, Array],
    default: () => ''
  },
  defaultModelValue: {
    type: String,
    default: ''
  },
  valueType: {
    type: String,
    default: 'value'
  },
  miniMap: {
    type: Boolean,
    default: false
  },
  isBind: {
    type: Boolean,
    default: false
  },
  height: {
    type: Number,
    default: 400
  },
  language: {
    type: String,
    default: 'freemarker2'
  },
  readonly: {
    type: Boolean,
    default: false
  }
});

const options = {
  tabSize: 2,
  automaticLayout: true,
  scrollBeyondLastLine: false,
  language: props.language,
  theme: 'light',
  autoIndent: true,
  minimap: { enabled: props.miniMap },
  readOnly: props.readonly,
  folding: true,
  acceptSuggestionOnCommitCharacter: true,
  acceptSuggestionOnEnter: true,
  contextmenu: true
};

const emit = defineEmits(['update:modelValue']);
const eitorRef = ref();

let instance;

const initEditorValue = () => {
  if (props.valueType === 'value' && typeof props.modelValue === 'string') {
    instance.setValue(props.modelValue);
  } else if (props.valueType === 'value' && props.modelValue?._onWillDispose === undefined) {
    instance.setValue(formatJson(props.modelValue));
  } else if (props.modelValue) {
    instance.setModel(toRaw(props.modelValue));
  } else {
    instance.setModel(monaco.editor.createModel(props.defaultModelValue, props.language));
  }
};

watch(
  () => props.modelValue,
  () => initEditorValue()
);

onMounted(() => {
  instance = monaco.editor.create(eitorRef.value, options);
  initEditorValue();

  instance.onDidBlurEditorText(() => {
    emit('update:modelValue', toRaw(props.valueType === 'value' ? instance.getValue() : instance.getModel()));
  });
});

const getInstance = () => instance;

defineExpose({ getInstance, initEditorValue });
</script>

<style scoped lang="scss">
.editor {
  border: 1px solid var(--color-border-2);
  border-radius: 3px;
  background: var(--color-bg-2);
}
</style>
