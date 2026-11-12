-- 笔记客户端开通 social 授权，支持第三方登录（登录或自动开户）。

UPDATE sys_client
SET grant_type = 'clientPassword,social'
WHERE client_id = 'd9df3c0228c05e5c61db46348bcadf6e';
