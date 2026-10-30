/**
 * 生成指定长度的随机字符串
 * @param length 长度 (默认 43)
 * @returns 随机字符串 (URL-safe)
 */
export function generateRandomString(length = 43): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += charset[randomValues[i] % charset.length];
  }
  return result;
}

/**
 * 对字符串做 SHA-256 哈希
 * @param plain 明文
 * @returns ArrayBuffer 哈希结果
 */
export async function sha256(plain: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return crypto.subtle.digest('SHA-256', data);
}

/**
 * ArrayBuffer 转 Base64URL 编码（无填充）
 * @param buffer ArrayBuffer
 * @returns Base64URL 字符串
 */
export function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * 生成 PKCE code_challenge (S256)
 * @param codeVerifier code_verifier
 * @returns code_challenge
 */
export async function generateCodeChallenge(codeVerifier: string): Promise<string> {
  const hash = await sha256(codeVerifier);
  return base64UrlEncode(hash);
}

/**
 * 从 URL 中提取查询参数
 * @param url URL 字符串
 * @returns 参数对象
 */
export function getQueryParams(url: string): Record<string, string> {
  const queryString = url.split('?')[1];
  if (!queryString) return {};
  const params: Record<string, string> = {};
  const pairs = queryString.split('&');
  for (const pair of pairs) {
    const [key, value] = pair.split('=');
    if (key) {
      params[decodeURIComponent(key)] = decodeURIComponent(value || '');
    }
  }
  return params;
}
