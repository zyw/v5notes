<template>
  <div class="upload-file">
    <el-upload
      ref="fileUploadRef"
      multiple
      :action="uploadFileUrl"
      :before-upload="handleBeforeUpload"
      :file-list="fileList"
      :limit="limit"
      :on-error="handleUploadError"
      :on-exceed="handleExceed"
      :on-success="handleUploadSuccess"
      :show-file-list="false"
      :headers="headers"
      class="upload-file-uploader"
    >
      <!-- 上传按钮 -->
      <el-button type="primary">{{ $t('widgets.fileUpload.pick') }}</el-button>
    </el-upload>
    <!-- 上传提示 -->
    <div v-if="showTip" class="el-upload__tip">
      <template v-if="fileSize && fileType">
        {{ $t('widgets.upload.tipBothLead') }}<b style="color: #f56c6c">{{ fileSize }}MB</b>{{ $t('widgets.upload.tipBothMid') }}<b style="color: #f56c6c">{{ fileType.join('/') }}</b>{{ $t('widgets.upload.tipBothTail') }}
      </template>
      <template v-else-if="fileSize">
        {{ $t('widgets.upload.tipSizeLead') }}<b style="color: #f56c6c">{{ fileSize }}MB</b>{{ $t('widgets.upload.tipSizeTail') }}
      </template>
      <template v-else-if="fileType">
        {{ $t('widgets.upload.tipTypeLead') }}<b style="color: #f56c6c">{{ fileType.join('/') }}</b>{{ $t('widgets.upload.tipTypeTail') }}
      </template>
    </div>
    <!-- 文件列表 -->
    <transition-group class="upload-file-list el-upload-list el-upload-list--text" name="el-fade-in-linear" tag="ul">
      <li v-for="(file, index) in fileList" :key="file.id" class="el-upload-list__item ele-upload-list__item-content">
        <el-link :href="`${file.url}`" underline="never" target="_blank">
          <span class="el-icon-document"> {{ getFileName(file.name) }} </span>
        </el-link>
        <div class="ele-upload-list__item-content-action">
          <el-button type="danger" link @click="handleDelete(index)">{{ $t('common.delete') }}</el-button>
        </div>
      </li>
    </transition-group>
  </div>
</template>

<script setup lang="ts">
import modal from '@/plugins/modal';
import { propTypes } from '@/utils/propTypes';
import { delFile, listByIds } from '@/api/basics/file';
import { globalHeaders } from '@/utils/request';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const props = defineProps({
  modelValue: {
    type: [String, Object, Array],
    default: () => []
  },
  // 数量限制
  limit: propTypes.number.def(5),
  // 大小限制(MB)
  fileSize: propTypes.number.def(5),
  // 文件类型, 例如['png', 'jpg', 'jpeg']
  fileType: propTypes.array.def(['doc', 'xls', 'ppt', 'txt', 'pdf','docx','xlsx','pptx','md']),
  // 是否显示提示
  isShowTip: propTypes.bool.def(true)
});

const emit = defineEmits(['update:modelValue']);
const number = ref(0);
const uploadList = ref<any[]>([]);

const baseUrl = import.meta.env.VITE_APP_BASE_API;
const uploadFileUrl = ref(baseUrl + '/basics/admin/file/upload'); // 上传文件服务器地址
const headers = ref(globalHeaders());

const fileList = ref<any[]>([]);
const showTip = computed(() => props.isShowTip && (props.fileType || props.fileSize));

const fileUploadRef = ref<ElUploadInstance>();

watch(
  () => props.modelValue,
  async (val) => {
    if (val) {
      // 首先将值转为数组
      let list: any[] = [];
      if (Array.isArray(val)) {
        list = val;
      } else {
        const res = await listByIds(val as string);
        list = res.data.map((file) => {
          return {
            name: file.path,
            url: file.url,
            id: file.id
          };
        });
      }
      // 然后将数组转为对象数组
      fileList.value = list.map((item) => {
        item = { name: item.name, url: item.url, id: item.id };
        // item.uid = item.uid || new Date().getTime() + temp++;
        return item;
      });
    } else {
      fileList.value = [];
      return [];
    }
  },
  { deep: true, immediate: true }
);

// 上传前校检格式和大小
const handleBeforeUpload = (file: any) => {
  // 校检文件类型
  if (props.fileType.length) {
    const fileName = file.name.split('.');
    const fileExt = fileName[fileName.length - 1];
    const isTypeOk = props.fileType.indexOf(fileExt) >= 0;
    if (!isTypeOk) {
      modal.msgError(t('widgets.fileUpload.invalidType', { types: props.fileType.join('/') }));
      return false;
    }
  }
  // 校检文件大小
  if (props.fileSize) {
    const isLt = file.size / 1024 / 1024 < props.fileSize;
    if (!isLt) {
      modal.msgError(t('widgets.fileUpload.sizeExceeded', { size: props.fileSize }));
      return false;
    }
  }
  modal.loading(t('widgets.fileUpload.uploading'));
  number.value++;
  return true;
};

// 文件个数超出
const handleExceed = () => {
  modal.msgError(t('widgets.upload.countExceeded', { limit: props.limit }));
};

// 上传失败
const handleUploadError = () => {
  modal.msgError(t('widgets.fileUpload.failed'));
};

// 上传成功回调
const handleUploadSuccess = (res: any, file: UploadFile) => {
  if (res.code === 200) {
    uploadList.value.push({
      name: res.data.path,
      url: res.data.url,
      id: res.data.id
    });
    uploadedSuccessfully();
  } else {
    number.value--;
    modal.closeLoading();
    modal.msgError(res.msg);
    fileUploadRef.value?.handleRemove(file);
    uploadedSuccessfully();
  }
};

// 删除文件
const handleDelete = (index: number) => {
  let id = fileList.value[index].id;
  delFile(id);
  fileList.value.splice(index, 1);
  emit('update:modelValue', listToString(fileList.value));
};

// 上传结束处理
const uploadedSuccessfully = () => {
  if (number.value > 0 && uploadList.value.length === number.value) {
    fileList.value = fileList.value.filter((f) => f.url !== undefined).concat(uploadList.value);
    uploadList.value = [];
    number.value = 0;
    emit('update:modelValue', listToString(fileList.value));
    modal.closeLoading();
  }
};

// 获取文件名称
const getFileName = (name: string) => {
  // 如果是url那么取最后的名字 如果不是直接返回
  if (name.lastIndexOf('/') > -1) {
    return name.slice(name.lastIndexOf('/') + 1);
  } else {
    return name;
  }
};

// 对象转成指定字符串分隔
const listToString = (list: any[], separator?: string) => {
  let strs = '';
  separator = separator || ',';
  list.forEach((item) => {
    if (item.id) {
      strs += item.id + separator;
    }
  });
  return strs != '' ? strs.substring(0, strs.length - 1) : '';
};
</script>

<style scoped lang="scss">
.upload-file-uploader {
  margin-bottom: 5px;
}

.upload-file-list .el-upload-list__item {
  border: 1px solid #e4e7ed;
  line-height: 2;
  margin-bottom: 10px;
  position: relative;
}

.upload-file-list .ele-upload-list__item-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: inherit;
}

.ele-upload-list__item-content-action .el-link {
  margin-right: 10px;
}
</style>
