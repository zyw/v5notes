import { EditTypeEnum } from "@/enums/EditTypeEnum";

export interface NotesTreeVo {
  /**
   * ID
   */
  id: string;

  /**
   * 父节点ID
   */
  pid: string;

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

export interface EditInfoVo {
  dirId: string,
  type?: EditTypeEnum
}




//=================================================================================================

export interface DirectoryVO {
  /**
   * ID
   */
  id: string;

  /**
   * 目录所属用户ID
   */
  userId: string;

  /**
   * 目录名称
   */
  name: string;

  /**
   * 父目录ID
   */
  pid: string;

  /**
   * 描述
   */
  descr: string;
}

export interface DirectoryForm extends BaseEntity {
  /**
   * ID
   */
  id?: string;

  /**
   * 目录名称
   */
  name?: string;

  /**
   * 父目录ID
   */
  pid?: string;

  /**
   * 描述
   */
  descr?: string;
}

export interface DirectoryQuery extends PageQuery {
  /**
   * 目录所属用户ID
   */
  userId?: string;

  /**
   * 目录名称
   */
  name?: string;

  /**
   * 父目录ID
   */
  pid?: string;

  /**
   * 描述
   */
  descr?: string;

  /**
   * 日期范围参数
   */
  params?: any;
}
