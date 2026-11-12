import { listClientStorage } from '@/api/notes/dashboard';
import type { ClientStorageRank } from '@/api/notes/dashboard/types';

/**
 * 管理端按客户端用户筛选时的账号下拉选项。
 */
export function useClientOwnerOptions() {
  const ownerOptions = ref<ClientStorageRank[]>([]);
  const ownerLoading = ref(false);

  const ownerLabel = (item: ClientStorageRank) => {
    if (item.nickName && item.nickName !== item.userName) {
      return `${item.nickName}（${item.userName}）`;
    }
    return item.userName;
  };

  const loadOwnerOptions = async () => {
    ownerLoading.value = true;
    try {
      const res = await listClientStorage({ pageNum: 1, pageSize: 500 });
      ownerOptions.value = res.data?.rows ?? [];
    } finally {
      ownerLoading.value = false;
    }
  };

  return {
    ownerOptions,
    ownerLoading,
    ownerLabel,
    loadOwnerOptions
  };
}
