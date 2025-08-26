export interface ModelsVO {
  /**
   * 编号
   */
  id: string | number;

  /**
   * 供应商ID，所属供应商
   */
  supplierId: string | number;

  /**
   * 模型ID
   */
  modelId: string | number;

  /**
   * 模型展示名称
   */
  name: string;

  /**
   * 模型类型：1:LLM,2:Text Embedding,3:Rerank,4:TTS,5:Speech2text,6:Moderation
   */
  type: number;

  /**
   * 模型上下文长度
   */
  contextLen: number;

  /**
   * 最大token
   */
  maxToken: number;

  /**
   * 函数调用方式：0：不支持，1：Function Call，2：Tool Call
   */
  functionCalling: number;

  /**
   * 流式函数调用：0：不支持，1：支持
   */
  streamFunctionCalling: string;

  /**
   * 是否视觉支持：0：不支持，1：支持
   */
  vision: string;

  /**
   * 状态:0正常,1停用
   */
  status: string;
}

export interface ModelsForm extends BaseEntity {
  /**
   * 编号
   */
  id?: string | number;

  /**
   * 供应商ID，所属供应商
   */
  supplierId?: string | number;

  /**
   * 模型ID
   */
  modelId?: string | number;

  /**
   * 模型展示名称
   */
  name?: string;

  /**
   * 模型类型：1:LLM,2:Text Embedding,3:Rerank,4:TTS,5:Speech2text,6:Moderation
   */
  type?: number;

  /**
   * 模型上下文长度
   */
  contextLen?: number;

  /**
   * 最大token
   */
  maxToken?: number;

  /**
   * 函数调用方式：0：不支持，1：Function Call，2：Tool Call
   */
  functionCalling?: number;

  /**
   * 流式函数调用：0：不支持，1：支持
   */
  streamFunctionCalling?: string;

  /**
   * 是否视觉支持：0：不支持，1：支持
   */
  vision?: string;

  /**
   * 状态:0正常,1停用
   */
  status?: string;
}

export interface ModelsQuery extends PageQuery {
  /**
   * 供应商ID，所属供应商
   */
  supplierId?: string | number;

  /**
   * 模型ID
   */
  modelId?: string | number;

  /**
   * 模型展示名称
   */
  name?: string;

  /**
   * 模型类型：1:LLM,2:Text Embedding,3:Rerank,4:TTS,5:Speech2text,6:Moderation
   */
  type?: number;

  /**
   * 模型上下文长度
   */
  contextLen?: number;

  /**
   * 最大token
   */
  maxToken?: number;

  /**
   * 函数调用方式：0：不支持，1：Function Call，2：Tool Call
   */
  functionCalling?: number;

  /**
   * 流式函数调用：0：不支持，1：支持
   */
  streamFunctionCalling?: string;

  /**
   * 是否视觉支持：0：不支持，1：支持
   */
  vision?: string;

  /**
   * 状态:0正常,1停用
   */
  status?: string;

  /**
   * 日期范围参数
   */
  params?: any;
}
