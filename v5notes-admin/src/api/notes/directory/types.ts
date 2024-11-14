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
