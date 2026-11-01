export interface NotesVO {
    /**
     * 笔记ID编号
     */
    id: string;
  
    /**
     * 笔记所属用户
     */
    userId: string;
  
    /**
     * 笔记名
     */
    name: string;
  
    /**
     * 所属目录ID
     */
    dirId: string;

    /**
     * 修改时间
     */
    updateTime: string;

    /**
     * 文件大小
     */
    fileSize: string;

    /**
     * 内容
     */
    content: string;
  }
  export interface NotesForm extends BaseEntity {
    /**
     * 笔记ID编号
     */
    id?: string;
  
    /**
     * 笔记名
     */
    name?: string;
  
    /**
     * 所属目录ID
     */
    dirId?: string;
  
    /**
     * 笔记内容
     */
    content?: string;
  }
  export interface NotesQuery extends PageQuery {
  
    /**
     * 所属目录ID
     */
    dirId?: string;
  }

  export interface NotesSearch {
    /**
     * 所属目录ID
     */
    dirId?: string;
    /**
     * 查询内容
     */
    searchValue?: string;
  }
