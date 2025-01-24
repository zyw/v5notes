<template>
    <div>
      <transition :enter-active-class="proxy?.animate.searchAnimate.enter" :leave-active-class="proxy?.animate.searchAnimate.leave">
        <div v-show="showSearch" class="mb-[10px]">
          <el-card shadow="hover">
            <el-form ref="queryFormRef" :model="queryParams" :inline="true">
              <el-form-item label="关键字" prop="name">
                <el-input v-model="queryParams.searchValue" placeholder="输入关键字搜索标题和内容" clearable @keyup.enter="handleQuery" />
              </el-form-item>
              <el-form-item label="创建时间" style="width: 308px">
                  <el-date-picker
                    v-model="dateRange"
                    value-format="YYYY-MM-DD HH:mm:ss"
                    type="daterange"
                    range-separator="-"
                    start-placeholder="开始日期"
                    end-placeholder="结束日期"
                    :default-time="[new Date(2000, 1, 1, 0, 0, 0), new Date(2000, 1, 1, 23, 59, 59)]"
                  ></el-date-picker>
              </el-form-item>
              <el-form-item>
                <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
                <el-button icon="Refresh" @click="resetQuery">重置</el-button>
              </el-form-item>
            </el-form>
          </el-card>
        </div>
      </transition>
  
      <el-card shadow="never">
        <template #header>
          <el-row :gutter="10" class="mb8">
            <el-col :span="1.5">
              <el-button type="primary" plain icon="Plus" @click="handleAdd" v-hasPermi="['system:notes:add']">新增</el-button>
            </el-col>
            <el-col :span="1.5">
              <el-button type="success" plain icon="Edit" :disabled="single" @click="handleUpdate()" v-hasPermi="['system:notes:edit']">修改</el-button>
            </el-col>
            <el-col :span="1.5">
              <el-button type="danger" plain icon="Delete" :disabled="multiple" v-hasPermi="['system:notes:remove']" @click="handleDelete()">
                删除
              </el-button>
            </el-col>
            <el-col :span="1.5">
              <el-button type="warning" plain icon="Download" @click="handleExport" v-hasPermi="['system:notes:export']">导出</el-button>
            </el-col>
            <right-toolbar v-model:showSearch="showSearch" @queryTable="getList"></right-toolbar>
          </el-row>
        </template>
  
        <el-table v-loading="loading" :data="notesList" @selection-change="handleSelectionChange">
          <el-table-column type="selection" width="55" align="center" />
          <!-- <el-table-column v-if="true" label="笔记ID编号" align="center" prop="id" />
          <el-table-column label="笔记所属用户" align="center" prop="userId" /> -->
          <el-table-column label="笔记名" align="center" prop="name" />
          <el-table-column label="文件大小" align="center" prop="fileSize" />
          <el-table-column label="修改时间" align="center" prop="updateTime" />
          <el-table-column label="操作" align="center" class-name="small-padding fixed-width">
            <template #default="scope">
              <el-tooltip content="修改" placement="top">
                <el-button link type="primary" icon="Edit" @click="handleUpdate(scope.row)" v-hasPermi="['system:notes:edit']"></el-button>
              </el-tooltip>
              <el-tooltip content="删除" placement="top">
                <el-button link type="primary" icon="Delete" @click="handleDelete(scope.row)" v-hasPermi="['system:notes:remove']"></el-button>
              </el-tooltip>
            </template>
          </el-table-column>
        </el-table>
  
        <pagination v-show="total > 0" :total="total" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" @pagination="getList" />
      </el-card>
      <!-- 添加或修改笔记对话框 -->
      <el-dialog :title="dialog.title" v-model="dialog.visible" width="500px" append-to-body>
        <el-form ref="notesFormRef" :model="form" :rules="rules" label-width="80px">
          <el-form-item label="笔记所属用户" prop="userId">
            <el-input v-model="form.userId" placeholder="请输入笔记所属用户" />
          </el-form-item>
          <el-form-item label="笔记名" prop="name">
            <el-input v-model="form.name" placeholder="请输入笔记名" />
          </el-form-item>
          <el-form-item label="所属目录ID" prop="dirId">
            <el-input v-model="form.dirId" placeholder="请输入所属目录ID" />
          </el-form-item>
          <el-form-item label="笔记内容">
            <editor v-model="form.content" :min-height="192" />
          </el-form-item>
        </el-form>
        <template #footer>
          <div class="dialog-footer">
            <el-button :loading="buttonLoading" type="primary" @click="submitForm">确 定</el-button>
            <el-button @click="cancel">取 消</el-button>
          </div>
        </template>
      </el-dialog>
    </div>
  </template>
  
  <script setup name="Notes" lang="ts">
  import { listNotes, getNotes, delNotes, addNotes, updateNotes } from '@/api/notes/notes';
  import { NotesVO, NotesQuery, NotesForm } from '@/api/notes/notes/types';
  
  const { proxy } = getCurrentInstance() as ComponentInternalInstance;
  
  const dateRange = ref<[DateModelType, DateModelType]>(['', '']);
  
  const notesList = ref<NotesVO[]>([]);
  const buttonLoading = ref(false);
  const loading = ref(true);
  const showSearch = ref(true);
  const ids = ref<Array<string | number>>([]);
  const single = ref(true);
  const multiple = ref(true);
  const total = ref(0);
  
  const queryFormRef = ref<ElFormInstance>();
  const notesFormRef = ref<ElFormInstance>();

  const emit =   defineEmits(['clearQuery']);
  
  const dialog = reactive<DialogOption>({
    visible: false,
    title: ''
  });
  
  const initFormData: NotesForm = {
    id: undefined,
    userId: undefined,
    name: undefined,
    dirId: undefined,
    content: undefined
  };
  const data = reactive<PageData<NotesForm, NotesQuery>>({
    form: { ...initFormData },
    queryParams: {
      pageNum: 1,
      pageSize: 10,
      searchValue: undefined,
      dirId: undefined,
      params: {}
    },
    rules: {
      id: [{ required: true, message: '笔记ID编号不能为空', trigger: 'blur' }],
      userId: [{ required: true, message: '笔记所属用户不能为空', trigger: 'blur' }],
      name: [{ required: true, message: '笔记名不能为空', trigger: 'blur' }],
      dirId: [{ required: true, message: '所属目录ID不能为空', trigger: 'blur' }],
      content: [{ required: true, message: '笔记内容不能为空', trigger: 'blur' }]
    }
  });
  
  const { queryParams, form, rules } = toRefs(data);
  
  /** 查询笔记列表 */
  const getList = async () => {
    loading.value = true;
    const res = await listNotes(proxy?.addDateRange(queryParams.value, dateRange.value));
    notesList.value = res.rows;
    total.value = res.total;
    loading.value = false;
  };
  
  /** 取消按钮 */
  const cancel = () => {
    reset();
    dialog.visible = false;
  };
  
  /** 表单重置 */
  const reset = () => {
    form.value = { ...initFormData };
    notesFormRef.value?.resetFields();
  };

  /** 点击外层目录树查询 */
  const handleDirIdQuery = (dirId: string) => {
    queryParams.value.dirId = dirId;
    handleQuery();
  };
  
  /** 搜索按钮操作 */
  const handleQuery = () => {
    queryParams.value.pageNum = 1;
    getList();
  };
  
  /** 重置按钮操作 */
  const resetQuery = () => {
    emit('clearQuery');
    dateRange.value = ['', ''];
    queryParams.value.pageNum = 1;
    queryParams.value.searchValue = undefined;
    queryParams.value.dirId = undefined;
    handleQuery();
  };
  
  /** 多选框选中数据 */
  const handleSelectionChange = (selection: NotesVO[]) => {
    ids.value = selection.map((item) => item.id);
    single.value = selection.length != 1;
    multiple.value = !selection.length;
  };
  
  /** 新增按钮操作 */
  const handleAdd = () => {
    reset();
    dialog.visible = true;
    dialog.title = '添加笔记';
  };
  
  /** 修改按钮操作 */
  const handleUpdate = async (row?: NotesVO) => {
    reset();
    const _id = row?.id || ids.value[0];
    const res = await getNotes(_id);
    Object.assign(form.value, res.data);
    dialog.visible = true;
    dialog.title = '修改笔记';
  };
  
  /** 提交按钮 */
  const submitForm = () => {
    notesFormRef.value?.validate(async (valid: boolean) => {
      if (valid) {
        buttonLoading.value = true;
        if (form.value.id) {
          await updateNotes(form.value).finally(() => (buttonLoading.value = false));
        } else {
          await addNotes(form.value).finally(() => (buttonLoading.value = false));
        }
        proxy?.$modal.msgSuccess('操作成功');
        dialog.visible = false;
        await getList();
      }
    });
  };
  
  /** 删除按钮操作 */
  const handleDelete = async (row?: NotesVO) => {
    const _ids = row?.id || ids.value;
    await proxy?.$modal.confirm('是否确认删除笔记编号为"' + _ids + '"的数据项？').finally(() => (loading.value = false));
    await delNotes(_ids);
    proxy?.$modal.msgSuccess('删除成功');
    await getList();
  };
  
  /** 导出按钮操作 */
  const handleExport = () => {
    proxy?.download(
      'system/notes/export',
      {
        ...queryParams.value
      },
      `notes_${new Date().getTime()}.xlsx`
    );
  };

  defineExpose({
    handleDirIdQuery
  });
  
  onMounted(() => {
    getList();
  });
  </script>
  <style lang="scss" scoped>
      .notes-list:hover {
          background-color: #edf2f7;
          font-weight: 700;
      }
      .va-1 {
          vertical-align: -1px;
      }
  </style>