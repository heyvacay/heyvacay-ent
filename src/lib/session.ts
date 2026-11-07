'use client';

/**
 * Lightweight "has this browser ever signed in?" marker. It is NOT auth — real
 * auth is the per-account workspace + the active-account pointer. This flag only
 * decides whether a returning visitor who lands on the marketing site should be
 * sent straight to their workspace (auto-login) instead of seeing the pitch again.
 *
 * Set on every successful sign-in / sign-up, cleared on explicit sign-out.
 */
export const SIGNED_IN_KEY = 'hv_ent_signed_in';

export function markSignedIn(): void {
  try {
    localStorage.setItem(SIGNED_IN_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function clearSignedIn(): void {
  try {
    localStorage.removeItem(SIGNED_IN_KEY);
  } catch {
    /* ignore */
  }
}

export function hasSignedIn(): boolean {
  try {
    return localStorage.getItem(SIGNED_IN_KEY) === '1';
  } catch {
    return false;
  }
}
