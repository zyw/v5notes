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
