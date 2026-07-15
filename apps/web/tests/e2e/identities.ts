export const e2eIdentities = {
  admin: {
    username: "e2e_admin",
    displayName: "E2E Administrator",
    password: "e2e-admin-password-only",
    role: "ADMIN",
    status: "ACTIVE",
  },
  user: {
    username: "e2e_user",
    displayName: "E2E User",
    password: "e2e-user-password-only",
    role: "USER",
    status: "ACTIVE",
  },
  muted: {
    username: "e2e_muted",
    displayName: "E2E Muted User",
    password: "e2e-muted-password-only",
    role: "USER",
    status: "MUTED",
  },
  banned: {
    username: "e2e_banned",
    displayName: "E2E Banned User",
    password: "e2e-banned-password-only",
    role: "USER",
    status: "BANNED",
  },
  governed: {
    username: "e2e_governed",
    displayName: "E2E Governed User",
    password: "e2e-governed-password-only",
    role: "USER",
    status: "ACTIVE",
  },
} as const;
