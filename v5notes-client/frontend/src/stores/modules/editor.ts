// 定义是否折叠小仓库[选择式Api写法]
import { defineStore } from "pinia";
import { updateNotes } from '@/api/notes'
import { NotesForm } from "@/api/notes/types";

// defineStore方法执行会返回一个函数，函数的作用就是让组件可以获取到仓库数据
const useEditorStore = defineStore("editor", () => {
  // 是否需要保存，需要：true,不需要：false
  const hasSave = ref(false);
  const mdEditorForm = ref<NotesForm>();

  const handleSaveContent = async () => {
    await updateNotes(mdEditorForm.value)
    hasSave.value = false
    ElMessage.success("保存成功")
}

  return {
    hasSave,
    mdEditorForm,
    handleSaveContent
  }
});

// 对外暴露方法
export default useEditorStore;