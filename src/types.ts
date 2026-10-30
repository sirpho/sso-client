/** SSO 客户端配置 */
export interface SsoClientConfig {
  /** 应用 clientId */
  clientId: string;
  /** SSO 服务器地址 (e.g. http://localhost:23456) */
  endpoint: string;
  /** 回调地址 (e.g. http://localhost:10086/callback) */
  redirectUri: string;
}

/** Token 响应 */
export interface TokenResponse {
  /** JWT access_token */
  accessToken: string;
  /** 刷新 token */
  refreshToken: string;
  /** id_token (OIDC) */
  idToken?: string;
  /** 过期时间 (秒) */
  expiresIn?: number;
  /** token 类型 */
  tokenType?: string;
}

/** sessionStorage 中存储的会话数据 */
export interface SignInSession {
  /** PKCE code_verifier */
  codeVerifier: string;
  /** 防 CSRF state */
  state: string;
  /** 回调地址 */
  redirectUri: string;
}

/** OIDC 发现文档 */
export interface OidcConfig {
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  end_session_endpoint: string;
  introspection_endpoint?: string;
}
