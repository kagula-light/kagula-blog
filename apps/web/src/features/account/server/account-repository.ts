import type { DatabaseClient } from "@kagura/database/client";
import { comments, favorites, posts } from "@kagura/database/schema";
import { desc, eq } from "drizzle-orm";

export interface AccountFavorite {
  readonly postId: string;
  readonly title: string;
  readonly slug: string;
  readonly postStatus: "DRAFT" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED";
  readonly createdAt: Date;
}

export interface AccountComment {
  readonly id: string;
  readonly postId: string;
  readonly postTitle: string;
  readonly postSlug: string;
  readonly body: string;
  readonly status: "PENDING" | "APPROVED" | "REJECTED" | "DELETED";
  readonly createdAt: Date;
}

export interface AccountActivity {
  readonly favorites: readonly AccountFavorite[];
  readonly comments: readonly AccountComment[];
}

export interface AccountRepository {
  readonly getActivity: (userId: string) => Promise<AccountActivity>;
}

export function createAccountRepository(database: DatabaseClient): AccountRepository {
  return {
    getActivity: async (userId) => {
      const [favoriteRows, commentRows] = await Promise.all([
        database.db
          .select({
            postId: favorites.postId,
            title: posts.title,
            slug: posts.slug,
            postStatus: posts.status,
            createdAt: favorites.createdAt,
          })
          .from(favorites)
          .innerJoin(posts, eq(posts.id, favorites.postId))
          .where(eq(favorites.userId, userId))
          .orderBy(desc(favorites.createdAt)),
        database.db
          .select({
            id: comments.id,
            postId: comments.postId,
            postTitle: posts.title,
            postSlug: posts.slug,
            body: comments.body,
            status: comments.status,
            createdAt: comments.createdAt,
          })
          .from(comments)
          .innerJoin(posts, eq(posts.id, comments.postId))
          .where(eq(comments.authorUserId, userId))
          .orderBy(desc(comments.createdAt)),
      ]);
      return { favorites: favoriteRows, comments: commentRows };
    },
  };
}
