export interface NotesVO {
  /**
   * 笔记ID编号
   */
  id: string | number;

  /**
   * 笔记所属用户
   */
  userId: string | number;

  /**
   * 笔记名
   */
  name: string;

  /**
   * 所属目录ID
   */
  dirId: string | number;

  /**
   * 修改时间
   */
  updateTime: string;

  /**
   * 文件大小
   */
  fileSize: string;

  /**
   * 笔记内容
   */
  content: string;

  /**
   * 当前正文 SHA-256
   */
  contentHash?: string;
}

export interface NoteRevisionVO {
  id: string | number;
  noteId: string | number;
  contentHash: string;
  excerpt?: string;
  size?: number;
  createTime?: string;
  head?: boolean;
}

export interface NoteRevisionDetailVO extends NoteRevisionVO {
  content: string;
}

export interface NoteRestoreVO {
  content: string;
  contentHash: string;
  updateTime?: string;
}

export interface NotesForm extends BaseEntity {
  /**
   * 笔记ID编号
   */
  id?: string | number;

  /**
   * 笔记所属用户
   */
  userId?: string | number;

  /**
   * 笔记名
   */
  name?: string;

  /**
   * 所属目录ID
   */
  dirId?: string | number;

  /**
   * 笔记内容
   */
  content?: string;
}

export interface NotesQuery extends PageQuery {
  /**
   * 笔记名
   */
  searchValue?: string;

  /**
   * 所属目录ID
   */
  dirId?: string | number;

  /**
   * 日期范围参数
   */
  params?: any;
}
