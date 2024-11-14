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

export interface FileQuery extends PageQuery {
  name: string;
  type: string;
  createTime: string;
}

export interface FileForm {
  file: undefined | string;
}
