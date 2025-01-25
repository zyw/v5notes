export interface DirectoryVO {
  /**
   * ID
   */
  id: string | number;

  /**
   * 目录所属用户ID
   */
  userId: string | number;

  /**
   * 目录名称
   */
  name: string;

  /**
   * 父目录ID
   */
  pid: string | number;

  /**
   * 描述
   */
  descr: string;

  /**
   * 创建时间
   */
  createTime: string;
}

export interface DirectoryForm extends BaseEntity {
  /**
   * ID
   */
  id?: string | number;

  /**
   * 目录所属用户ID
   */
  userId?: string | number;

  /**
   * 目录名称
   */
  name?: string;

  /**
   * 父目录ID
   */
  pid?: string | number;

  /**
   * 描述
   */
  descr?: string;
}

export interface DirectoryQuery extends PageQuery {
  /**
   * 目录所属用户ID
   */
  userId?: string | number;

  /**
   * 目录名称
   */
  name?: string;

  /**
   * 父目录ID
   */
  pid?: string | number;

  /**
   * 描述
   */
  descr?: string;

  /**
   * 日期范围参数
   */
  params?: any;
}

export interface NotesTreeVo {
  /**
   * ID
   */
  id: number;

  /**
   * 父节点ID
   */
  pid: number;

  /**
   * 节点名称
   */
  label: string;

  /**
   * 节点类型，1：目录，2：笔记
   */
  type: number;

  /**
   * 树形子目录
   */
  children: NotesTreeVo[];
}
