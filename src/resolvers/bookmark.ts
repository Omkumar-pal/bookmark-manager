import type { Bookmark, Prisma } from "@prisma/client";
import type { GraphQLContext } from "../types/context.js";
import { validateTitle, validateUrl } from "../lib/validation.js";
import { notFoundError, badUserInputError } from "../lib/errors.js";

// ─── Cursor Helpers ───────────────────────────────────────────────

/**
 * Encodes a bookmark into an opaque cursor string.
 * Format: base64("createdAt::id") — both fields ensure deterministic ordering.
 */
function encodeCursor(bookmark: Bookmark): string {
  const raw = `${bookmark.createdAt.toISOString()}::${bookmark.id}`;
  return Buffer.from(raw).toString("base64");
}

const BASE64_REGEX = /^[A-Za-z0-9+/]+={0,2}$/;

/**
 * Decodes an opaque cursor back into createdAt + id.
 * Note: `id` is validated as non-empty but not strictly checked against UUID
 * format here — malformed IDs are safely handled downstream by Prisma's
 * findMany/findUnique, which return empty/null rather than throwing.
 * Throws GraphQLError (BAD_USER_INPUT) for structurally invalid cursors.
 */
function decodeCursor(cursor: string): { createdAt: Date; id: string } {
  if (!BASE64_REGEX.test(cursor) || cursor.length % 4 !== 0) {
    throw badUserInputError("Invalid cursor format");
  }

  const raw = Buffer.from(cursor, "base64").toString("utf-8");

  const separatorIndex = raw.indexOf("::");
  if (separatorIndex === -1) {
    throw badUserInputError("Invalid cursor format");
  }
  const createdAtStr = raw.substring(0, separatorIndex).trim();
  const id = raw.substring(separatorIndex + 2).trim();

  const createdAt = new Date(createdAtStr);
  if (!createdAtStr || !id || isNaN(createdAt.getTime())) {
    throw badUserInputError("Invalid cursor format");
  }

  return { createdAt, id };
}

// ─── Argument Types ───────────────────────────────────────────────

interface BookmarksArgs {
  folderId?: string | null;
  search?: string | null;
  take?: number | null;
  cursor?: string | null;
}

interface CreateBookmarkArgs {
  title: string;
  url: string;
  tags?: string[] | null;
  folderId: string;
}

interface UpdateBookmarkArgs {
  id: string;
  title?: string | null;
  url?: string | null;
  tags?: string[] | null;
}

interface DeleteBookmarkArgs {
  id: string;
}

interface MoveBookmarkArgs {
  id: string;
  folderId: string;
}

// ─── Resolvers ────────────────────────────────────────────────────

export const bookmarkResolvers = {
  Query: {
    bookmarks: async (_parent: unknown, args: BookmarksArgs, context: GraphQLContext) => {
      const limit = Math.min(Math.max(args.take ?? 20, 1), 50); // Clamp between 1 and 50

      // Build the WHERE clause with optional filters
      const where: Prisma.BookmarkWhereInput = {};

      // Optional: filter by folder
      if (args.folderId) {
        where.folderId = args.folderId;
      }

      // Optional: case-insensitive title search
      if (args.search) {
        where.title = {
          contains: args.search,
          mode: "insensitive",
        };
      }

      // Cursor condition: fetch items AFTER this cursor position
      if (args.cursor) {
        const decoded = decodeCursor(args.cursor);
        where.OR = [
          { createdAt: { lt: decoded.createdAt } },
          {
            createdAt: { equals: decoded.createdAt },
            id: { lt: decoded.id },
          },
        ];
      }

      // Fetch take + 1 to determine if there's a next page
      const bookmarks = await context.prisma.bookmark.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit + 1,
      });

      // Count total matching bookmarks (for totalCount field)
      const totalCountWhere: Prisma.BookmarkWhereInput = {};
      if (args.folderId) {
        totalCountWhere.folderId = args.folderId;
      }
      if (args.search) {
        totalCountWhere.title = {
          contains: args.search,
          mode: "insensitive",
        };
      }
      const totalCount = await context.prisma.bookmark.count({ where: totalCountWhere });

      // Determine if there's a next page
      const hasNextPage = bookmarks.length > limit;

      // Trim the extra item we fetched for page detection
      const trimmedBookmarks = hasNextPage ? bookmarks.slice(0, limit) : bookmarks;

      // Build edges with cursors
      const edges = trimmedBookmarks.map((bookmark) => ({
        cursor: encodeCursor(bookmark),
        node: bookmark,
      }));

      // endCursor is the cursor of the last item on this page
      const lastEdge = edges[edges.length - 1];
      const endCursor = lastEdge ? lastEdge.cursor : null;

      return {
        edges,
        pageInfo: {
          hasNextPage,
          endCursor,
        },
        totalCount,
      };
    },
  },

  Bookmark: {
    // Nested resolver: fetch the parent folder for a bookmark
    folder: async (parent: Bookmark, _args: unknown, context: GraphQLContext) => {
      return context.prisma.folder.findUnique({
        where: { id: parent.folderId },
      });
    },
    // Format Date to ISO string
    createdAt: (parent: Bookmark): string => {
      return parent.createdAt instanceof Date ? parent.createdAt.toISOString() : String(parent.createdAt);
    },
  },

  Mutation: {
    createBookmark: async (_parent: unknown, args: CreateBookmarkArgs, context: GraphQLContext) => {
      const validTitle = validateTitle(args.title);
      const validUrl = validateUrl(args.url);

      // Verify the target folder exists
      const folder = await context.prisma.folder.findUnique({
        where: { id: args.folderId },
      });
      if (!folder) {
        throw notFoundError("Folder", args.folderId);
      }

      return context.prisma.bookmark.create({
        data: {
          title: validTitle,
          url: validUrl,
          tags: args.tags ?? [],
          folderId: args.folderId,
        },
      });
    },

    updateBookmark: async (_parent: unknown, args: UpdateBookmarkArgs, context: GraphQLContext) => {
      // Verify the bookmark exists
      const existing = await context.prisma.bookmark.findUnique({
        where: { id: args.id },
      });
      if (!existing) {
        throw notFoundError("Bookmark", args.id);
      }

      // Build update data — only include fields that were provided
      const data: Prisma.BookmarkUpdateInput = {};
      if (args.title !== undefined && args.title !== null) {
        data.title = validateTitle(args.title);
      }
      if (args.url !== undefined && args.url !== null) {
        data.url = validateUrl(args.url);
      }
      if (args.tags !== undefined && args.tags !== null) {
        data.tags = args.tags;
      }

      return context.prisma.bookmark.update({
        where: { id: args.id },
        data,
      });
    },

    deleteBookmark: async (_parent: unknown, args: DeleteBookmarkArgs, context: GraphQLContext) => {
      // Verify the bookmark exists
      const existing = await context.prisma.bookmark.findUnique({
        where: { id: args.id },
      });
      if (!existing) {
        throw notFoundError("Bookmark", args.id);
      }

      return context.prisma.bookmark.delete({
        where: { id: args.id },
      });
    },

    moveBookmark: async (_parent: unknown, args: MoveBookmarkArgs, context: GraphQLContext) => {
      // Verify the bookmark exists
      const existing = await context.prisma.bookmark.findUnique({
        where: { id: args.id },
      });
      if (!existing) {
        throw notFoundError("Bookmark", args.id);
      }

      // Verify the target folder exists
      const folder = await context.prisma.folder.findUnique({
        where: { id: args.folderId },
      });
      if (!folder) {
        throw notFoundError("Folder", args.folderId);
      }

      return context.prisma.bookmark.update({
        where: { id: args.id },
        data: { folderId: args.folderId },
      });
    },
  },
};
