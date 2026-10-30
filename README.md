# @sirpho/sso-client

SSO 单点登录前端 SDK — 实现 OAuth 2.0 / OIDC + PKCE 协议。

框架无关，纯 TypeScript 实现，可用于 Vue、React 或任何前端项目。

## 安装

```bash
pnpm add @sirpho/sso-client
```

## 使用

```typescript
import {SsoClient} from '@sirpho/sso-client';

const client = new SsoClient({
  clientId: 'sirpho-vxe-admin',
  endpoint: 'https://www.sirpho.top/api',
  redirectUri: `${location.origin}/callback`,
});

// 发起登录
await client.signIn();

// 在回调页面处理
if (client.isSignInRedirected()) {
  const token = await client.handleSignInCallback();
  console.log('登录成功', token.accessToken);
}

// 获取 token
const accessToken = client.getAccessToken();

// 登出
client.signOut();
```

## API

| 方法                           | 说明                              |
|------------------------------|---------------------------------|
| `signIn()`                   | 生成 PKCE 参数，跳转 SSO 授权页           |
| `handleSignInCallback(url?)` | 处理回调，用 code 换 token             |
| `isSignInRedirected(url?)`   | 判断 URL 是否为 SSO 回调               |
| `getLoginState(url?)`        | 检查登录状态                          |
| `signOut()`                  | 清除本地 token，跳转 SSO 登出页           |
| `getAccessToken()`           | 获取 access_token                 |
| `getRefreshToken()`          | 获取 refresh_token                |
| `clearTokens()`              | 清除所有本地 token                    |
| `refreshAccessToken()`       | 用 refresh_token 刷新 access_token |
| `discover()`                 | 获取 OIDC 发现文档                    |

# 发布npm版本

1. 修改`package.json`中的版本号
2. 运行`pnpm build`打包
3. 运行`npm login`登录
4. 运行`npm publish`发布
