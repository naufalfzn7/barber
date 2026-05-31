"use client";

export async function refreshSession(): Promise<boolean> {
  try {
    const response = await fetch("/api/auth/refresh", {
      method: "POST",
      cache: "no-store",
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function authFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const requestInit: RequestInit = {
    cache: "no-store",
    credentials: "same-origin",
    ...init,
  };

  const response = await fetch(input, requestInit);

  if (response.status !== 401) {
    return response;
  }

  const refreshed = await refreshSession();
  if (!refreshed) {
    return response;
  }

  return fetch(input, requestInit);
}

export function notifyClientDataChanged(eventName = "app:data-changed"): void {
  window.dispatchEvent(new Event(eventName));
}
