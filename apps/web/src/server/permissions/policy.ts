export type UserRole = "ADMIN" | "USER";
export type UserStatus = "ACTIVE" | "MUTED" | "BANNED";

export interface PermissionIdentity {
  readonly id: string;
  readonly role: UserRole;
  readonly status: UserStatus;
}

export function canAccessAdmin(identity: PermissionIdentity | null): boolean {
  return identity?.role === "ADMIN" && identity.status !== "BANNED";
}

export function canCreateComment(identity: PermissionIdentity | null): boolean {
  return identity !== null && identity.status === "ACTIVE";
}
