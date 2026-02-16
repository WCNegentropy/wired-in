import type { Page } from '@playwright/test';

const GATEWAY_URL = process.env.E2E_GATEWAY_URL || 'http://localhost:8080';

/**
 * Register a test user via the API and store the JWT token in localStorage.
 */
export async function registerViaApi(
  page: Page,
  email: string,
  password: string,
  name?: string,
): Promise<{ userId: string; token: string }> {
  const res = await page.request.post(`${GATEWAY_URL}/api/auth/register`, {
    data: { email, password, name },
  });
  const json = await res.json();
  const token = json.data?.token;
  const userId = json.data?.user?.id;

  await page.evaluate(
    (t) => localStorage.setItem('wiredin_token', t),
    token,
  );

  return { userId, token };
}

/**
 * Login via the API and store the JWT token in localStorage.
 */
export async function loginViaApi(
  page: Page,
  email: string,
  password: string,
): Promise<{ userId: string; token: string }> {
  const res = await page.request.post(`${GATEWAY_URL}/api/auth/login`, {
    data: { email, password },
  });
  const json = await res.json();
  const token = json.data?.token;
  const userId = json.data?.user?.id;

  await page.evaluate(
    (t) => localStorage.setItem('wiredin_token', t),
    token,
  );

  return { userId, token };
}

/**
 * Create a workspace via the API.
 */
export async function createWorkspaceViaApi(
  page: Page,
  name: string,
  description = '',
): Promise<string> {
  const token = await page.evaluate(() => localStorage.getItem('wiredin_token'));
  const res = await page.request.post(`${GATEWAY_URL}/api/workspaces`, {
    data: { name, description },
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  return json.data?.id;
}

/**
 * Generate a unique email for test isolation.
 */
export function uniqueEmail(): string {
  return `test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
}
