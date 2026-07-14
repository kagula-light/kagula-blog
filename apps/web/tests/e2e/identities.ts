export const e2eIdentities = {
  admin: {
    username: "e2e_admin",
    displayName: "E2E Administrator",
    password: "e2e-admin-password-only",
    role: "ADMIN",
  },
  user: {
    username: "e2e_user",
    displayName: "E2E User",
    password: "e2e-user-password-only",
    role: "USER",
  },
} as const;
