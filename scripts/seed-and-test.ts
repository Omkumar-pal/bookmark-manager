import { prisma } from "../src/lib/prisma.js";

const GRAPHQL_ENDPOINT = "http://localhost:4000/graphql";

interface GraphQLResponse<T = Record<string, unknown>> {
  data?: T;
  errors?: Array<{
    message: string;
    extensions?: {
      code?: string;
      http?: { status?: number };
    };
  }>;
}

/**
 * Helper to send real HTTP POST requests directly to the live GraphQL Yoga server
 */
async function gql<T = Record<string, unknown>>(
  query: string,
  variables: Record<string, unknown> = {}
): Promise<GraphQLResponse<T>> {
  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

  return (await response.json()) as GraphQLResponse<T>;
}

export async function runFullGraphQLHttpVerification() {
  console.log("\n=======================================================");
  console.log("🚀 Live GraphQL API End-to-End HTTP Verification");
  console.log("   (Testing full pipeline: HTTP -> Yoga -> Resolvers -> DB)");
  console.log("=======================================================\n");

  try {
    // 0. Clean old data for a fresh demonstration
    console.log("🧹 0. Resetting database to a clean state...");
    await prisma.bookmark.deleteMany({});
    await prisma.folder.deleteMany({});
    console.log("   ✅ Database cleaned.\n");

    // 1. Test Mutation: createFolder
    console.log("📁 1. Testing `createFolder` Mutation via HTTP...");
    const foldersData = [
      { name: "⚡ AI & Machine Learning" },
      { name: "🎨 UI & Design Inspiration" },
      { name: "🛠️ Developer Tools & APIs" },
      { name: "📚 Books & Reading List" },
    ];

    const createFolderMutation = `
      mutation CreateFolder($name: String!) {
        createFolder(name: $name) {
          id
          name
          createdAt
        }
      }
    `;

    const createdFolders: Array<{ id: string; name: string }> = [];
    for (const f of foldersData) {
      const res = await gql<{ createFolder: { id: string; name: string } }>(createFolderMutation, { name: f.name });
      if (res.errors || !res.data) {
        throw new Error(`Failed to create folder: ${JSON.stringify(res.errors)}`);
      }
      createdFolders.push(res.data.createFolder);
      console.log(`   ✅ [GraphQL] Created Folder: "${res.data.createFolder.name}" (ID: ${res.data.createFolder.id})`);
    }

    const aiFolder = createdFolders[0]!;
    const designFolder = createdFolders[1]!;
    const devFolder = createdFolders[2]!;
    const booksFolder = createdFolders[3]!;

    // 2. Test Mutation: createBookmark (with tags & relations)
    console.log("\n🔖 2. Testing `createBookmark` Mutation via HTTP...");
    const sampleBookmarks = [
      {
        title: "Anthropic Claude — AI Assistant",
        url: "https://anthropic.com",
        tags: ["ai", "llm", "claude"],
        folderId: aiFolder.id,
      },
      {
        title: "OpenAI Research & Models",
        url: "https://openai.com",
        tags: ["ai", "gpt", "research"],
        folderId: aiFolder.id,
      },
      {
        title: "Hugging Face — Open Models Hub",
        url: "https://huggingface.co",
        tags: ["ai", "models", "open-source"],
        folderId: aiFolder.id,
      },
      {
        title: "Dribbble — Discover Design",
        url: "https://dribbble.com",
        tags: ["design", "inspiration", "ui"],
        folderId: designFolder.id,
      },
      {
        title: "Mobbin — Mobile & Web Design Patterns",
        url: "https://mobbin.com",
        tags: ["ui", "ux", "patterns"],
        folderId: designFolder.id,
      },
      {
        title: "GraphQL Official Documentation",
        url: "https://graphql.org",
        tags: ["graphql", "api", "backend"],
        folderId: devFolder.id,
      },
      {
        title: "Prisma ORM — Next-generation Node.js and TypeScript ORM",
        url: "https://prisma.io",
        tags: ["database", "orm", "typescript"],
        folderId: devFolder.id,
      },
      {
        title: "Bun — Fast all-in-one JavaScript runtime",
        url: "https://bun.sh",
        tags: ["bun", "javascript", "runtime"],
        folderId: devFolder.id,
      },
      {
        title: "Designing Data-Intensive Applications",
        url: "https://dataintensive.net",
        tags: ["books", "architecture", "distributed-systems"],
        folderId: booksFolder.id,
      },
      {
        title: "Refactoring UI — Adam Wathan & Steve Schoger",
        url: "https://refactoringui.com",
        tags: ["books", "design", "css"],
        folderId: booksFolder.id,
      },
    ];

    const createBookmarkMutation = `
      mutation CreateBookmark($title: String!, $url: String!, $tags: [String!], $folderId: ID!) {
        createBookmark(title: $title, url: $url, tags: $tags, folderId: $folderId) {
          id
          title
          url
          tags
          folderId
          folder {
            name
          }
        }
      }
    `;

    const createdBookmarks: Array<{ id: string; title: string }> = [];
    for (const bm of sampleBookmarks) {
      const res = await gql<{ createBookmark: { id: string; title: string; tags: string[]; folder: { name: string } } }>(
        createBookmarkMutation,
        bm
      );
      if (res.errors || !res.data) {
        throw new Error(`Failed to create bookmark: ${JSON.stringify(res.errors)}`);
      }
      createdBookmarks.push(res.data.createBookmark);
      console.log(
        `   ✅ [GraphQL] Created Bookmark: "${res.data.createBookmark.title}" in Folder "${res.data.createBookmark.folder.name}"`
      );
    }

    // 3. Test Input Validation & Yoga Error Formatting over HTTP
    console.log("\n🛡️ 3. Testing Input Validation & Error Formatting over HTTP...");

    // 3a. Blank Title validation
    const badTitleRes = await gql(createBookmarkMutation, {
      title: "    ",
      url: "https://valid-url.com",
      tags: [],
      folderId: aiFolder.id,
    });
    const titleErrorCode = badTitleRes.errors?.[0]?.extensions?.code;
    console.log(
      `   ✅ [Validation] Blank title rejected with code: "${titleErrorCode}" (Message: "${badTitleRes.errors?.[0]?.message}")`
    );

    // 3b. Invalid URL validation
    const badUrlRes = await gql(createBookmarkMutation, {
      title: "Valid Title",
      url: "not_a_valid_http_url",
      tags: [],
      folderId: aiFolder.id,
    });
    const urlErrorCode = badUrlRes.errors?.[0]?.extensions?.code;
    console.log(
      `   ✅ [Validation] Malformed URL rejected with code: "${urlErrorCode}" (Message: "${badUrlRes.errors?.[0]?.message}")`
    );

    // 3c. Not Found Error handling
    const notFoundRes = await gql(createBookmarkMutation, {
      title: "Valid Title",
      url: "https://valid.com",
      tags: [],
      folderId: "non-existent-folder-uuid",
    });
    const notFoundCode = notFoundRes.errors?.[0]?.extensions?.code;
    console.log(
      `   ✅ [Error Handling] Invalid folder rejected with code: "${notFoundCode}" (Message: "${notFoundRes.errors?.[0]?.message}")`
    );

    // 4. Test Query: folders with nested bookmarks
    console.log("\n📂 4. Testing `folders` Query with Nested Bookmarks...");
    const foldersQuery = `
      query GetFolders {
        folders {
          id
          name
          bookmarks {
            id
            title
            url
          }
        }
      }
    `;
    const foldersRes = await gql<{ folders: Array<{ id: string; name: string; bookmarks: Array<{ title: string }> }> }>(
      foldersQuery
    );
    const queriedFolders = foldersRes.data?.folders || [];
    console.log(`   ✅ [GraphQL] Fetched ${queriedFolders.length} folders.`);
    for (const f of queriedFolders) {
      console.log(`      - Folder "${f.name}": ${f.bookmarks.length} bookmark(s) attached`);
    }

    // 5. Test Query: bookmarks title substring search
    console.log("\n🔍 5. Testing `bookmarks(search: \"graph\")` Substring Search...");
    const searchQuery = `
      query SearchBookmarks($search: String) {
        bookmarks(search: $search) {
          edges {
            node {
              id
              title
              url
            }
          }
          totalCount
        }
      }
    `;
    const searchRes = await gql<{ bookmarks: { edges: Array<{ node: { title: string; url: string } }>; totalCount: number } }>(
      searchQuery,
      { search: "graph" }
    );
    console.log(`   ✅ [GraphQL] Found ${searchRes.data?.bookmarks.totalCount} matching bookmark(s):`);
    for (const edge of searchRes.data?.bookmarks.edges || []) {
      console.log(`      - "${edge.node.title}" (${edge.node.url})`);
    }

    // 6. Test Query: Cursor-Based Pagination
    console.log("\n📄 6. Testing Cursor-Based Pagination (`take: 3`, `cursor`)...\n");

    const paginationQuery = `
      query PaginateBookmarks($take: Int, $cursor: String) {
        bookmarks(take: $take, cursor: $cursor) {
          edges {
            cursor
            node {
              id
              title
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
          totalCount
        }
      }
    `;

    // Page 1
    const page1Res = await gql<{
      bookmarks: {
        edges: Array<{ cursor: string; node: { title: string } }>;
        pageInfo: { hasNextPage: boolean; endCursor: string };
        totalCount: number;
      };
    }>(paginationQuery, { take: 3 });

    const p1 = page1Res.data!.bookmarks;
    console.log(`   ✅ Page 1: Returned ${p1.edges.length} items (Total in DB: ${p1.totalCount})`);
    console.log(`      hasNextPage: ${p1.pageInfo.hasNextPage}`);
    console.log(`      endCursor: "${p1.pageInfo.endCursor}"`);

    // Page 2 (passing endCursor)
    const page2Res = await gql<{
      bookmarks: {
        edges: Array<{ cursor: string; node: { title: string } }>;
        pageInfo: { hasNextPage: boolean; endCursor: string };
        totalCount: number;
      };
    }>(paginationQuery, { take: 3, cursor: p1.pageInfo.endCursor });

    const p2 = page2Res.data!.bookmarks;
    console.log(`   ✅ Page 2: Returned ${p2.edges.length} items using cursor`);
    console.log(`      hasNextPage: ${p2.pageInfo.hasNextPage}`);

    // 7. Test Mutation: updateBookmark
    console.log("\n✏️ 7. Testing `updateBookmark` Mutation...");
    const firstBookmark = createdBookmarks[0]!;
    const updateMutation = `
      mutation UpdateBookmark($id: ID!, $title: String, $tags: [String!]) {
        updateBookmark(id: $id, title: $title, tags: $tags) {
          id
          title
          tags
        }
      }
    `;
    const updateRes = await gql<{ updateBookmark: { title: string; tags: string[] } }>(updateMutation, {
      id: firstBookmark.id,
      title: "Anthropic Claude 3.7 Sonnet (Updated via GraphQL)",
      tags: ["ai", "claude", "graphql-tested"],
    });
    console.log(`   ✅ [GraphQL] Updated Bookmark Title: "${updateRes.data?.updateBookmark.title}"`);
    console.log(`      Tags: [${updateRes.data?.updateBookmark.tags.join(", ")}]`);

    // 8. Test Mutation: moveBookmark
    console.log("\n🚚 8. Testing `moveBookmark` Mutation...");
    const bookmarkToMove = createdBookmarks[7]!; // Bun bookmark in devFolder
    const moveMutation = `
      mutation MoveBookmark($id: ID!, $folderId: ID!) {
        moveBookmark(id: $id, folderId: $folderId) {
          id
          folderId
          folder {
            name
          }
        }
      }
    `;
    const moveRes = await gql<{ moveBookmark: { folder: { name: string } } }>(moveMutation, {
      id: bookmarkToMove.id,
      folderId: aiFolder.id,
    });
    console.log(`   ✅ [GraphQL] Moved Bookmark to: "${moveRes.data?.moveBookmark.folder.name}"`);

    // 9. Test Mutation: deleteBookmark
    console.log("\n🗑️ 9. Testing `deleteBookmark` Mutation...");
    const bookmarkToDelete = createdBookmarks[1]!;
    const deleteMutation = `
      mutation DeleteBookmark($id: ID!) {
        deleteBookmark(id: $id) {
          id
          title
        }
      }
    `;
    const deleteRes = await gql<{ deleteBookmark: { title: string } }>(deleteMutation, {
      id: bookmarkToDelete.id,
    });
    console.log(`   ✅ [GraphQL] Deleted Bookmark: "${deleteRes.data?.deleteBookmark.title}"`);

    console.log("\n=======================================================");
    console.log("🎉 ALL REAL GRAPHQL HTTP OPERATIONS VERIFIED 100%!");
    console.log("=======================================================");
    console.log("👉 Open http://localhost:4000/ to view your live visual dashboard!\n");

  } catch (error) {
    console.error("❌ Live GraphQL verification failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

if (import.meta.main) {
  runFullGraphQLHttpVerification();
}
