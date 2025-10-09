export interface TemplateVO {
  /**
   * ID
   */
  id: string | number;

  /**
   * 模版类型
   */
  tpType: string;

  /**
   * 模版名称
   */
  name: string;

  /**
   * 模版内容
   */
  content: string;

  /**
   * 模版名称，需要包含生成文件的扩展名
   */
  fileName: string;

  /**
   * 生成文件路径，如果为空生成文件在压缩包的跟目录下
   */
  filePath: string;

  /**
   * 状态:0正常,1停用
   */
  status: string;
}

export interface TemplateForm extends BaseEntity {
  /**
   * ID
   */
  id?: string | number;

  /**
   * 模版类型
   */
  tpType?: string;

  /**
   * 模版名称
   */
  name?: string;

  /**
   * 模版内容
   */
  content?: string;

  /**
   * 模版名称，需要包含生成文件的扩展名
   */
  fileName?: string;

  /**
   * 生成文件路径，如果为空生成文件在压缩包的跟目录下
   */
  filePath?: string;

  /**
   * 状态:0正常,1停用
   */
  status?: string;
}

export interface TemplateQuery extends PageQuery {
  /**
   * 模版类型
   */
  tpType?: string;

  /**
   * 模版名称
   */
  name?: string;

  /**
   * 模版内容
   */
  content?: string;

  /**
   * 模版名称，需要包含生成文件的扩展名
   */
  fileName?: string;

  /**
   * 生成文件路径，如果为空生成文件在压缩包的跟目录下
   */
  filePath?: string;

  /**
   * 状态:0正常,1停用
   */
  status?: string;

  /**
   * 日期范围参数
   */
  params?: any;
}
