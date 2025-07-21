export interface ModelSuppliersVO {
  /**
   * 编号
   */
  id: string | number;

  /**
   * 供应商名称，如：deepseek,通义千问
   */
  name: string;

  /**
   * LLM供应商图标URL
   */
  icon: string;

  /**
   * API基础URL，如：https://api.openai.com
   */
  baseUrl: string;

  /**
   * API密钥
   */
  apiKey: string;

  /**
   * API版本，目前：Azure OpenAI Service Model使用
   */
  apiVersion: string;

  /**
   * 单位：分钟；Ollama对话后模型在内存中保持的时间（默认：5分钟）
   */
  activeDuration: string;

  /**
   * 状态:0正常,1停用
   */
  status: string;

}

export interface ModelSuppliersForm extends BaseEntity {
  /**
   * 编号
   */
  id?: string | number;

  /**
   * 供应商名称，如：deepseek,通义千问
   */
  name?: string;

  /**
   * LLM供应商图标URL
   */
  icon?: string;

  /**
   * API基础URL，如：https://api.openai.com
   */
  baseUrl?: string;

  /**
   * API密钥
   */
  apiKey?: string;

  /**
   * API版本，目前：Azure OpenAI Service Model使用
   */
  apiVersion?: string;

  /**
   * 单位：分钟；Ollama对话后模型在内存中保持的时间（默认：5分钟）
   */
  activeDuration?: string;

  /**
   * 状态:0正常,1停用
   */
  status?: string;

}

export interface ModelSuppliersQuery extends PageQuery {

  /**
   * 供应商名称，如：deepseek,通义千问
   */
  name?: string;

  /**
   * LLM供应商图标URL
   */
  icon?: string;

  /**
   * API基础URL，如：https://api.openai.com
   */
  baseUrl?: string;

  /**
   * API密钥
   */
  apiKey?: string;

  /**
   * API版本，目前：Azure OpenAI Service Model使用
   */
  apiVersion?: string;

  /**
   * 单位：分钟；Ollama对话后模型在内存中保持的时间（默认：5分钟）
   */
  activeDuration?: string;

  /**
   * 状态:0正常,1停用
   */
  status?: string;

    /**
     * 日期范围参数
     */
    params?: any;
}



