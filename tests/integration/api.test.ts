import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { prisma } from "../../src/lib/prisma.js";
import { folderResolvers } from "../../src/resolvers/folder.js";
import { bookmarkResolvers } from "../../src/resolvers/bookmark.js";
import type { GraphQLContext } from "../../src/types/context.js";

const context: GraphQLContext = { prisma };

describe("PostgreSQL Integration Test Suite (Real Database)", () => {
  let createdFolderAId: string;
  let createdFolderBId: string;
  let createdBookmarkId: string;
  let secondBookmarkId: string;

  beforeAll(async () => {
    // Clean up test data if any exists
    await prisma.bookmark.deleteMany({});
    await prisma.folder.deleteMany({});
  });

  afterAll(async () => {
    // Clean up after tests run
    await prisma.bookmark.deleteMany({});
    await prisma.folder.deleteMany({});
    await prisma.$disconnect();
  });

  it("1. should create Folder A and Folder B in PostgreSQL", async () => {
    const folderA = await folderResolvers.Mutation.createFolder({}, { name: "Integration Work" }, context);
    expect(folderA.id).toBeDefined();
    expect(folderA.name).toBe("Integration Work");
    createdFolderAId = folderA.id;

    const folderB = await folderResolvers.Mutation.createFolder({}, { name: "Integration Archive" }, context);
    expect(folderB.id).toBeDefined();
    expect(folderB.name).toBe("Integration Archive");
    createdFolderBId = folderB.id;
  });

  it("2. should create Bookmarks associated with Folder A", async () => {
    const bm1 = await bookmarkResolvers.Mutation.createBookmark(
      {},
      {
        title: "GraphQL Documentation",
        url: "https://graphql.org",
        tags: ["graphql", "api", "docs"],
        folderId: createdFolderAId,
      },
      context
    );
    expect(bm1.id).toBeDefined();
    expect(bm1.title).toBe("GraphQL Documentation");
    expect(bm1.tags).toEqual(["graphql", "api", "docs"]);
    expect(bm1.folderId).toBe(createdFolderAId);
    createdBookmarkId = bm1.id;

    const bm2 = await bookmarkResolvers.Mutation.createBookmark(
      {},
      {
        title: "Prisma ORM Guide",
        url: "https://prisma.io",
        tags: ["database", "prisma"],
        folderId: createdFolderAId,
      },
      context
    );
    expect(bm2.id).toBeDefined();
    expect(bm2.title).toBe("Prisma ORM Guide");
    secondBookmarkId = bm2.id;
  });

  it("3. should fetch folder and its nested bookmarks", async () => {
    const folder = await folderResolvers.Query.folder({}, { id: createdFolderAId }, context);
    expect(folder).toBeDefined();
    expect(folder?.id).toBe(createdFolderAId);

    if (folder) {
      const bookmarks = await folderResolvers.Folder.bookmarks(folder, {}, context);
      expect(bookmarks.length).toBe(2);
      expect(bookmarks.map((b) => b.title)).toContain("GraphQL Documentation");
      expect(bookmarks.map((b) => b.title)).toContain("Prisma ORM Guide");
    }
  });

  it("4. should paginate bookmarks with cursor", async () => {
    // Page 1: take 1
    const page1 = await bookmarkResolvers.Query.bookmarks({}, { take: 1 }, context);
    expect(page1.edges).toHaveLength(1);
    expect(page1.pageInfo.hasNextPage).toBe(true);
    expect(page1.pageInfo.endCursor).toBeDefined();
    expect(page1.totalCount).toBe(2);

    const cursor = page1.pageInfo.endCursor;

    // Page 2: take 1 after cursor
    const page2 = await bookmarkResolvers.Query.bookmarks({}, { take: 1, cursor }, context);
    expect(page2.edges).toHaveLength(1);
    expect(page2.pageInfo.hasNextPage).toBe(false);
    expect(page2.edges[0]?.node.id).not.toBe(page1.edges[0]?.node.id);
  });

  it("5. should search bookmarks by title substring", async () => {
    const searchResult = await bookmarkResolvers.Query.bookmarks(
      {},
      { search: "graph" }, // Case-insensitive match for "GraphQL Documentation"
      context
    );
    expect(searchResult.edges).toHaveLength(1);
    expect(searchResult.edges[0]?.node.title).toBe("GraphQL Documentation");
  });

  it("6. should move a bookmark from Folder A to Folder B", async () => {
    const moved = await bookmarkResolvers.Mutation.moveBookmark(
      {},
      { id: createdBookmarkId, folderId: createdFolderBId },
      context
    );
    expect(moved.folderId).toBe(createdFolderBId);

    // Verify Folder B now has 1 bookmark
    const folderB = await folderResolvers.Query.folder({}, { id: createdFolderBId }, context);
    expect(folderB).toBeDefined();
    if (folderB) {
      const folderBBookmarks = await folderResolvers.Folder.bookmarks(folderB, {}, context);
      expect(folderBBookmarks).toHaveLength(1);
      expect(folderBBookmarks[0]?.id).toBe(createdBookmarkId);
    }
  });

  it("7. should delete a bookmark from PostgreSQL", async () => {
    const deleted = await bookmarkResolvers.Mutation.deleteBookmark({}, { id: secondBookmarkId }, context);
    expect(deleted.id).toBe(secondBookmarkId);

    // Verify it's no longer in the DB
    const remaining = await prisma.bookmark.findMany({});
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.id).toBe(createdBookmarkId);
  });
});
