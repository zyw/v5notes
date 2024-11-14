/**
 * 用户信息
 */
export interface UserInfo {
    user: UserVO;
    roles: string[];
    permissions: string[];
}
  
/**
 * 用户返回对象
 */
export interface UserVO extends BaseEntity {
    userId: string | number;
    tenantId: string;
    deptId: number;
    userName: string;
    nickName: string;
    userType: string;
    email: string;
    phonenumber: string;
    sex: string;
    avatarUrl: string;
    avatarId: string;
    status: string;
    delFlag: string;
    loginIp: string;
    loginDate: string;
    remark: string;
    deptName: string;
    roleIds: any;
    postIds: any;
    roleId: any;
    admin: boolean;
  }

  /**
 * 用户表单类型
 */
export interface UserForm {
    userId?: string;
    deptId?: string;
    userType?: string;
    userName?: string;
    nickName?: string;
    phonenumber?: string;
    email?: string;
    avatar?: string;
    sex?: string;
    remark?: string;
  }