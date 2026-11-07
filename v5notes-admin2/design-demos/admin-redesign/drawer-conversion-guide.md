# 弹窗 → 侧抽屉 改造规范（照 menu/index.vue）

**参照样板**：`src/views/system/menu/index.vue`（已改造完成，结构直接照抄），另可看 `src/views/system/user/index.vue`。

## 要做
把「新增/编辑」的 `<el-dialog>` 改成共享组件 `FormDrawer`（右侧滑出），并整理表单布局：

1. `<FormDrawer v-model="dialog.visible" :title="dialog.title" eyebrow="实体名 · 配置" subtitle="一句话说明" size="680px" submit-text="确定" hint="带 * 为必填项，保存后立即生效" @submit="submitForm" @closed="cancel">`
   - 删除原弹窗底部的 `<template #footer>` 按钮（FormDrawer 自带「取消/确定」）。
2. **#hero 深绿身份头**（照 menu 的 `.menu-hero`，本地改名 `.drawer-hero`）：
   - 顶行：`<img :src="logoUrl"> V5Notes · 实体名` · `{{ dialog.title }}`
   - 主体：图标方块（取实体名称首字）+ 实体名称 + 类型徽标 + 二级信息。
   - 需要 `import logoUrl from '@/assets/logo/logo.png'`。
3. **表单**：原 `<el-form>` 改为 `label-position="top"`、去掉 `label-width`、加 class（如 `notice-form`）。
   用分区：`<section class="form-section"><h4>基本信息</h4><el-row :gutter="18"><el-col :span="12">…</el-col>…</el-row></section>`，宽字段 `:span="24"`。至少分 2–4 个逻辑组（如 基本信息 / 内容或配置 / 状态 / 备注）。富文本/多行文本占整行并给高度。
4. **全部保留**：原有字段、v-if 联动、`prop` 校验、字典、按钮权限、提交/关闭/重置逻辑。只做「弹窗→抽屉 + 布局整理」，不改业务逻辑。
5. 追加样式块（照 menu 末尾）：
   `.xxx-form :deep(.el-form-item){margin-bottom:16px}`、`.xxx-form :deep(.el-form-item__label){padding-bottom:6px;line-height:1.3;font-size:12.5px;font-weight:600;color:#3f4a44}`、输入圆角 10；
   `.form-section{...}`、`.form-section h4{...}`、`.drawer-hero{...}`（从 menu 复制改名）。

## 约束
- **只改你负责的这一个文件**，不要动其它文件、不要动其它非目标弹窗。
- **不要运行 pnpm build**（Lead 统一构建）。
- 完成后 `send_message` 给 lead：改了哪个 dialog、字段怎么分组、有无风险。
