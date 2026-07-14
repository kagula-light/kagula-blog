import type { PermissionIdentity } from "../../../server/permissions/policy";

export type ReactionCommand = "LIKE" | "UNLIKE" | "FAVORITE" | "UNFAVORITE";
export type ReactionKind = "LIKE" | "FAVORITE";

export type ReactionResult =
  | { readonly status: "SUCCESS"; readonly active: boolean; readonly count: number }
  | { readonly status: "UNAUTHENTICATED" }
  | { readonly status: "FORBIDDEN" }
  | { readonly status: "POST_NOT_FOUND" };

export interface ReactionMutation {
  readonly userId: string;
  readonly postId: string;
  readonly kind: ReactionKind;
  readonly active: boolean;
}

export interface ReactionServiceDependencies {
  readonly mutateReaction: (
    input: ReactionMutation,
  ) => Promise<Exclude<ReactionResult, { status: "UNAUTHENTICATED" }>>;
}

export interface ReactionInput {
  readonly actor: PermissionIdentity | null;
  readonly postId: string;
  readonly command: ReactionCommand;
}

const mutationByCommand: Readonly<
  Record<ReactionCommand, Readonly<{ kind: ReactionKind; active: boolean }>>
> = {
  LIKE: { kind: "LIKE", active: true },
  UNLIKE: { kind: "LIKE", active: false },
  FAVORITE: { kind: "FAVORITE", active: true },
  UNFAVORITE: { kind: "FAVORITE", active: false },
};

export function createReactionService(
  dependencies: ReactionServiceDependencies,
): (input: ReactionInput) => Promise<ReactionResult> {
  return async ({ actor, postId, command }) => {
    if (!actor) return { status: "UNAUTHENTICATED" };
    if (actor.status === "BANNED") return { status: "FORBIDDEN" };

    const mutation = mutationByCommand[command];
    return dependencies.mutateReaction({
      userId: actor.id,
      postId,
      kind: mutation.kind,
      active: mutation.active,
    });
  };
}
