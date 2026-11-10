<template>
  <div class="component-upload-image">
    <el-upload
      ref="imageUpload"
      multiple
      :action="uploadImgUrl"
      list-type="picture-card"
      :on-success="handleUploadSuccess"
      :before-upload="handleBeforeUpload"
      :limit="limit"
      :on-error="handleUploadError"
      :on-exceed="handleExceed"
      :before-remove="handleDelete"
      :show-file-list="true"
      :headers="headers"
      :file-list="fileList"
      :on-preview="handlePictureCardPreview"
      :class="{ hide: fileList.length >= limit }"
    >
      <el-icon class="avatar-uploader-icon">
        <plus />
      </el-icon>
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

    <el-dialog v-model="dialogVisible" :title="$t('common.preview')" width="800px" append-to-body>
      <img :src="dialogImageUrl" style="display: block; max-width: 100%; margin: 0 auto" />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { listByIds, delFile } from '@/api/basics/file';
import { FileVO } from '@/api/basics/file/types';
import modal from '@/plugins/modal';
import { propTypes } from '@/utils/propTypes';
import { globalHeaders } from '@/utils/request';
import { compressAccurately } from 'image-conversion';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const props = defineProps({
  modelValue: {
    type: [String, Object, Array],
    default: () => []
  },
  // 图片数量限制
  limit: propTypes.number.def(5),
  // 大小限制(MB)
  fileSize: propTypes.number.def(5),
  // 文件类型, 例如['png', 'jpg', 'jpeg']
  fileType: propTypes.array.def(['png', 'jpg', 'jpeg']),
  // 是否显示提示
  isShowTip: {
    type: Boolean,
    default: true
  },
  // 是否支持压缩，默认否
  compressSupport: {
    type: Boolean,
    default: false
  },
  // 压缩目标大小，单位KB。默认300KB以上文件才压缩，并压缩至300KB以内
  compressTargetSize: propTypes.number.def(300)
});

const emit = defineEmits(['update:modelValue']);
const number = ref(0);
const uploadList = ref<any[]>([]);
const dialogImageUrl = ref('');
const dialogVisible = ref(false);

const baseUrl = import.meta.env.VITE_APP_BASE_API;
const uploadImgUrl = ref(baseUrl + '/basics/admin/file/upload'); // 上传的图片服务器地址
const headers = ref(globalHeaders());

const fileList = ref<any[]>([]);
const showTip = computed(() => props.isShowTip && (props.fileType || props.fileSize));

const imageUploadRef = ref<ElUploadInstance>();

watch(
  () => props.modelValue,
  async (val: string) => {
    if (val) {
      // 首先将值转为数组
      let list: FileVO[] = [];
      if (Array.isArray(val)) {
        list = val as FileVO[];
      } else {
        const res = await listByIds(val);
        list = res.data;
      }
      // 然后将数组转为对象数组
      fileList.value = list.map((item) => {
        // 字符串回显处理 如果此处存的是url可直接回显 如果存的是id需要调用接口查出来
        let itemData;
        if (typeof item === 'string') {
          itemData = { name: item, url: item };
        } else {
          // 此处name使用ossId 防止删除出现重名
          itemData = { name: item.id, url: item.url, id: item.id };
        }
        return itemData;
      });
    } else {
      fileList.value = [];
      return [];
    }
  },
  { deep: true, immediate: true }
);

/** 上传前loading加载 */
const handleBeforeUpload = (file: any) => {
  let isImg = false;
  if (props.fileType.length) {
    let fileExtension = '';
    if (file.name.lastIndexOf('.') > -1) {
      fileExtension = file.name.slice(file.name.lastIndexOf('.') + 1);
    }
    isImg = props.fileType.some((type: any) => {
      if (file.type.indexOf(type) > -1) return true;
      if (fileExtension && fileExtension.indexOf(type) > -1) return true;
      return false;
    });
  } else {
    isImg = file.type.indexOf('image') > -1;
  }
  if (!isImg) {
    modal.msgError(t('widgets.imageUpload.invalidType', { types: props.fileType.join('/') }));
    return false;
  }
  if (props.fileSize) {
    const isLt = file.size / 1024 / 1024 < props.fileSize;
    if (!isLt) {
      modal.msgError(t('widgets.imageUpload.avatarSize', { size: props.fileSize }));
      return false;
    }
  }

  //压缩图片，开启压缩并且大于指定的压缩大小时才压缩
  if (props.compressSupport && file.size / 1024 > props.compressTargetSize) {
    modal.loading(t('widgets.imageUpload.uploading'));
    number.value++;
    return compressAccurately(file, props.compressTargetSize);
  } else {
    modal.loading(t('widgets.imageUpload.uploading'));
    number.value++;
  }
};

// 文件个数超出
const handleExceed = () => {
  modal.msgError(t('widgets.upload.countExceeded', { limit: props.limit }));
};

// 上传成功回调
const handleUploadSuccess = (res: any, file: UploadFile) => {
  if (res.code === 200) {
    uploadList.value.push({ name: res.data.path, url: res.data.url, id: res.data.id });
    uploadedSuccessfully();
  } else {
    number.value--;
    modal.closeLoading();
    modal.msgError(res.msg);
    imageUploadRef.value?.handleRemove(file);
    uploadedSuccessfully();
  }
};

// 删除图片
const handleDelete = (file: UploadFile): boolean => {
  const findex = fileList.value.map((f) => f.name).indexOf(file.name);
  if (findex > -1 && uploadList.value.length === number.value) {
    let id = fileList.value[findex].id;
    delFile(id);
    fileList.value.splice(findex, 1);
    emit('update:modelValue', listToString(fileList.value));
    return false;
  }
  return true;
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

// 上传失败
const handleUploadError = () => {
  modal.msgError(t('widgets.imageUpload.failed'));
  modal.closeLoading();
};

// 预览
const handlePictureCardPreview = (file: any) => {
  dialogImageUrl.value = file.url;
  dialogVisible.value = true;
};

// 对象转成指定字符串分隔
const listToString = (list: any[], separator?: string) => {
  let strs = '';
  separator = separator || ',';
  for (let i in list) {
    if (undefined !== list[i].id && list[i].url.indexOf('blob:') !== 0) {
      strs += list[i].id + separator;
    }
  }
  return strs != '' ? strs.substring(0, strs.length - 1) : '';
};
</script>

<style scoped lang="scss">
// .el-upload--picture-card 控制加号部分
:deep(.hide .el-upload--picture-card) {
  display: none;
}
</style>
