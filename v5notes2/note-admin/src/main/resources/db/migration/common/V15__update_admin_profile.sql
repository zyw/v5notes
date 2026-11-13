-- 更新超级管理员初始化资料
UPDATE sys_user
SET nick_name = '云笔记管理员',
    email     = 'zyw090111@163.com',
    phone_number = '13899999999'
WHERE user_id = 1761100000000000001
  AND user_name = 'admin';
