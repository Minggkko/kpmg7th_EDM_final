// src/api/index.js
const BASE = "/api/v1";

export const getToken = () => localStorage.getItem("access_token");
export const setToken = (token) => localStorage.setItem("access_token", token);
export const removeToken = () => localStorage.removeItem("access_token");

export async function apiFetch(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
      ...options.headers,
    },
  });

  if (res.status === 401) {
    removeToken();
    window.location.href = "/login";
    return;
  }

  const data = await res.json();
  if (!res.ok) throw data;
  return data;
}