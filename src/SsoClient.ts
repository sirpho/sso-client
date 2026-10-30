import type {OidcConfig, SignInSession, SsoClientConfig, TokenResponse} from './types';
import {generateCodeChallenge, generateRandomString, getQueryParams} from './utils';

/** sessionStorage key 前缀 */
const SESSION_STORAGE_KEY = 'sirpho-sso-session';

export class SsoClient {
  private config: SsoClientConfig;
  private oidcConfig: OidcConfig | null = null;

  constructor(config: SsoClientConfig) {
    this.config = config;
  }

  /** --------------------------------------- */
  /**          PKCE 登录流程                    */
  /** --------------------------------------- */

  /**
   * 发起 SSO 登录
   * 生成 PKCE 参数 → 保存到 sessionStorage → 跳转 SSO 授权页
   */
  async signIn(): Promise<void> {
    const codeVerifier = generateRandomString(43);
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    const state = generateRandomString(32);

    // 保存 PKCE 会话信息到 sessionStorage
    const session: SignInSession = {
      codeVerifier,
      state,
      redirectUri: this.config.redirectUri,
    };
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));

    // 构建授权 URL
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state,
      scope: 'openid profile',
    });

    window.location.href = `${this.config.endpoint}/sso/authorize?${params.toString()}`;
  }

  /**
   * 处理 SSO 回调
   * 从 URL 提取 code → 用 code + code_verifier 换取 token
   * @param url 当前页面 URL (默认 window.location.href)
   * @returns TokenResponse
   */
  async handleSignInCallback(url = window.location.href): Promise<TokenResponse> {
    const params = getQueryParams(url);
    const { code, state } = params;

    if (!code) {
      throw new Error('回调 URL 缺少 code 参数');
    }

    // 从 sessionStorage 获取 PKCE 会话
    const sessionRaw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!sessionRaw) {
      throw new Error('未找到 PKCE 会话信息，请重新登录');
    }

    const session: SignInSession = JSON.parse(sessionRaw);

    // 验证 state 防 CSRF
    if (state && state !== session.state) {
      throw new Error('state 参数不匹配，可能存在 CSRF 攻击');
    }

    // 清除 sessionStorage 中的 PKCE 信息
    sessionStorage.removeItem(SESSION_STORAGE_KEY);

    // 用 code 换取 token
    return await this.fetchToken(code, session.codeVerifier, session.redirectUri);
  }

  /**
   * 检查 URL 是否为 SSO 回调（URL 中包含 code 参数）
   * @param url 当前页面 URL
   * @returns boolean
   */
  isSignInRedirected(url = window.location.href): boolean {
    const params = getQueryParams(url);
    return !!params.code;
  }

  /**
   * 检查登录状态（不跳转 SSO）
   * 用于 callback 页面无 code 时检测用户是否已在 SSO 登录
   * @returns TokenResponse 或抛出异常
   */
  async getLoginState(): Promise<TokenResponse> {
    const token = this.getAccessToken();
    if (!token) {
      // 无本地 token → 直接走 SSO 登录
      this.signIn();
      throw new Error('正在跳转登录...');
    }

    // 有本地 token → 向后端校验有效性
    const valid = await this.introspectToken(token);
    if (valid) {
      // token 有效，构造一个简单的 TokenResponse
      return {
        accessToken: token,
        refreshToken: this.getRefreshToken() || '',
        tokenType: 'Bearer',
      };
    }

    // token 无效 → 尝试用 refresh_token 续期
    try {
      return await this.refreshAccessToken();
    } catch {
      // 续期也失败 → 重新登录
      this.signIn();
      throw new Error('登录已过期，正在跳转重新登录...');
    }
  }

  /**
   * 向后端校验 access_token 是否有效
   * @returns 有效返回 true
   */
  async introspectToken(token: string): Promise<boolean> {
    try {
      const params = new URLSearchParams({ token });
      const resp = await fetch(`${this.config.endpoint}/sso/introspect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
        credentials: 'include',
      });
      if (!resp.ok) return false;
      const data = await resp.json();
      return data.data?.active === true;
    } catch {
      return false;
    }
  }

  /**
   * 登出
   * 清除本地 token → POST 请求 SSO 登出 → 跳转到登出后地址
   */
  async signOut(): Promise<void> {
    this.clearTokens();

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      post_logout_redirect_uri: this.config.redirectUri,
    });

    try {
      const resp = await fetch(`${this.config.endpoint}/sso/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
        credentials: 'include',
      });
      const data = await resp.json();
      window.location.href = data.data?.redirect_uri || this.config.redirectUri || '/';
    } catch {
      // 登出请求失败也跳转回调页
      window.location.href = this.config.redirectUri || '/';
    }
  }

  /** --------------------------------------- */
  /**          Token 管理                      */
  /** --------------------------------------- */

  /**
   * 保存 Token 到 sessionStorage
   */
  saveTokens(token: TokenResponse): void {
    sessionStorage.setItem('sirpho-sso-access-token', token.accessToken);
    if (token.refreshToken) {
      sessionStorage.setItem('sirpho-sso-refresh-token', token.refreshToken);
    }
    if (token.idToken) {
      sessionStorage.setItem('sirpho-sso-id-token', token.idToken);
    }
  }

  /** 获取 access_token */
  getAccessToken(): string | null {
    return sessionStorage.getItem('sirpho-sso-access-token');
  }

  /** 获取 refresh_token */
  getRefreshToken(): string | null {
    return sessionStorage.getItem('sirpho-sso-refresh-token');
  }

  /** 清除所有 token */
  clearTokens(): void {
    sessionStorage.removeItem('sirpho-sso-access-token');
    sessionStorage.removeItem('sirpho-sso-refresh-token');
    sessionStorage.removeItem('sirpho-sso-id-token');
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  }

  /**
   * 用 refresh_token 刷新 access_token
   * @returns 新的 TokenResponse
   */
  async refreshAccessToken(): Promise<TokenResponse> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      throw new Error('无 refresh_token');
    }

    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: this.config.clientId,
    });

    const resp = await fetch(`${this.config.endpoint}/sso/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!resp.ok) {
      throw new Error(`刷新 Token 失败: ${resp.status}`);
    }

    const token: TokenResponse = await resp.json();
    this.saveTokens(token);
    return token;
  }

  /** --------------------------------------- */
  /**          OIDC 发现                       */
  /** --------------------------------------- */

  /**
   * 获取 OIDC 发现文档
   */
  async discover(): Promise<OidcConfig> {
    if (this.oidcConfig) return this.oidcConfig;

    const resp = await fetch(
      `${this.config.endpoint}/.well-known/openid-configuration`,
    );
    if (!resp.ok) {
      throw new Error('获取 OIDC 配置失败');
    }

    this.oidcConfig = await resp.json();
    return this.oidcConfig!;
  }

  /** --------------------------------------- */
  /**          内部方法                         */
  /** --------------------------------------- */

  /**
   * 用 authorization_code 换取 token
   */
  private async fetchToken(
    code: string,
    codeVerifier: string,
    redirectUri: string,
  ): Promise<TokenResponse> {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      code_verifier: codeVerifier,
      redirect_uri: redirectUri,
      client_id: this.config.clientId,
    });

    const resp = await fetch(`${this.config.endpoint}/sso/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!resp.ok) {
      const errBody = await resp.text();
      throw new Error(`换取 Token 失败 (${resp.status}): ${errBody}`);
    }

    const token: TokenResponse = await resp.json();
    this.saveTokens(token);
    return token;
  }
}
