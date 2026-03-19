// src/api/auth.js
import { apiFetch, setToken, removeToken } from "./index";

// 로그인
export async function login(username, password) {
  const res = await apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  setToken(res.access_token);
  localStorage.setItem("user_id", res.user_id);
  localStorage.setItem("username", res.username);
  return res;
}

// 로그아웃
export async function logout() {
  await apiFetch("/auth/logout", { method: "POST" });
  removeToken();
  localStorage.removeItem("user_id");
  localStorage.removeItem("username");
}

// 회원가입
export async function signup(body) {
  return apiFetch("/auth/signup", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// 아이디 중복 확인
export async function checkUsername(username) {
  return apiFetch(`/auth/check-username/${username}`);
}

// 회사 검색
export async function searchCompanies(q = "") {
  return apiFetch(`/auth/companies?q=${encodeURIComponent(q)}`);
}

// 내 정보
export async function getMe() {
  return apiFetch("/auth/me");
}