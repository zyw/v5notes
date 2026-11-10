export interface FileVO extends BaseEntity {
  id: string | number;
  path: string;
  name: string;
  suffix: string;
  url: string;
  type: string;
  size: number;
  createTime: string;
}

/**
 * 文件上传返回对象（POST /basics/admin/file/upload）
 */
export interface FileUploadVO {
  /** 可访问 URL */
  url: string;
  /** 存储路径 */
  path: string;
  /** 文件主键 */
  id: string | number;
}

export interface FileQuery extends PageQuery {
  name: string;
  type: string;
  createTime: string;
}

export interface FileForm {
  file: undefined | string;
}
