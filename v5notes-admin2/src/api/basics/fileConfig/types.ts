export interface FileClientConfig {
  /**
   * 基础路径
   */
  basePath: string;
  /**
   * 自定义域名
   */
  domain: string;
  /**
   * FTP地址
   */
  host?: string;
  /**
   * FTP端口
   */
  port?: number;
  /**
   * FTP用户名
   */
  username?: string;
  /**
   * FTP密码
   */
  password?: string;
  /**
   * FTP模式
   */
  mode?: string;
  /**
   * 是否启用 FTPS（FTP over TLS，显式 AUTH TLS；与 SFTP 不同）
   */
  sslEnable?: boolean;
  /**
   * FTP 控制连接字符集（路径含中文时需与 NAS 一致，常见 UTF-8 / GBK）
   */
  charset?: string;
  /**
   * 存储路径
   */
  endpoint?: string;
  /**
   * 存储桶
   */
  bucket?: string;
  /**
   * 云存储AccessKey
   */
  accessKey?: string;
  /**
   * 云存储AccessSecret
   */
  accessSecret?: string;

  /**
   * 桶权限类型(0private 1public 2custom)
   */
  accessPolicy?: string;
}

export interface FileConfigVO {
  /**
   * 编号
   */
  id: string | number;

  /**
   * 配置名
   */
  name: string;

  /**
   * 存储器
   */
  storage: number;

  /**
   * 备注
   */
  remark: string;

  /**
   * 是否为主配置
   */
  master: number;

  /**
   * 存储配置
   */
  config: string;
}

export interface FileConfigForm extends BaseEntity {
  /**
   * 编号
   */
  id?: string | number;

  /**
   * 配置名
   */
  name?: string;

  /**
   * 存储器
   */
  storage?: number;

  /**
   * 备注
   */
  remark?: string;

  /**
   * 存储配置
   */
  config?: FileClientConfig;
}

export interface FileConfigQuery extends PageQuery {
  /**
   * 配置名
   */
  name?: string;

  /**
   * 存储器
   */
  storage?: number;

  /**
   * 日期范围参数
   */
  createTime?: any;
}
