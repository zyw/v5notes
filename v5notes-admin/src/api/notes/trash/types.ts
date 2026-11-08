export interface TrashVO {
  id: string | number;
  userId: string | number;
  userName: string;
  objectType: string;
  objectId: string | number;
  name: string;
  originalPath: string;
  noteCount: number;
  dirCount: number;
  deletedTime: string;
  expireTime: string;
  daysLeft: number;
}

export interface TrashQuery extends PageQuery {
  name?: string;
  objectType?: string;
  userName?: string;
}
