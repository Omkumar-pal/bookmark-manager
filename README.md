# Bookmark Manager GraphQL API

A clean, robust, schema-first Bookmark Manager GraphQL API built with **Bun**, **TypeScript** (strict mode), **GraphQL Yoga**, **Prisma ORM**, and **PostgreSQL** running in Docker.

---

## Table of Contents
- [Tech Stack](#tech-stack)
- [Architecture & Design Decisions](#architecture--design-decisions)
- [Setup & Local Development](#setup--local-development)
- [Environment Variables](#environment-variables)
- [Database & Migrations](#database--migrations)
- [Running Tests](#running-tests)
- [API Reference](#api-reference)
  - [Queries](#queries)
  - [Mutations](#mutations)
  - [Cursor-Based Pagination](#cursor-based-pagination)
- [Bonus Features](#bonus-features)
- [How I'd Extend This](#how-id-extend-this)

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Runtime** | [Bun](https://bun.sh) (v1.4+) | Fast all-in-one JavaScript runtime & package manager |
| **Language** | TypeScript (v5.8, strict mode) | Strict type safety with zero `any` usage |
| **GraphQL Server** | [GraphQL Yoga](https://the-guild.dev/graphql/yoga-server) + `graphql` | Schema-first GraphQL server with GraphiQL playground |
| **ORM** | [Prisma](https://www.prisma.io/) (v6.4) | Type-safe database queries and declarative migrations |
| **Database** | PostgreSQL 16 (Docker Compose) | Relational database with indexing & cascade delete |
| **Code Quality** | ESLint (v9 flat config) + `tsc --noEmit` | Strict linting rules enforcing no-explicit-any |

---

## Setup & Local Development

### Prerequisites
- [Bun](https://bun.sh) (v1.2+ or higher)
- [Docker & Docker Compose](https://www.docker.com/)

### Quickstart (One-Command Flow)

```bash
# 1. Start the PostgreSQL container
docker compose up -d

# 2. Install dependencies
bun install

# 3. Copy environment variables
cp .env.example .env

# 4. Run Prisma database migrations
bun run gendb

# 5. Start the development server
bun run dev
```

The GraphQL API and interactive GraphiQL playground will be accessible at:
👉 **`http://localhost:4000/graphql`**

---

## Environment Variables

| Variable | Description | Default / Example Value |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection URI | `postgresql://bookmark_user:bookmark_pass@localhost:5432/bookmark_manager` |
| `PORT` | HTTP server port *(optional)* | `4000` |

---

## Database & Migrations

- **Docker Compose**: Starts an isolated PostgreSQL 16 container with a persistent named volume (`pgdata`) and automated health checks.
- **Prisma Schema** (`prisma/schema.prisma`):
  - `Folder`: Unique UUID primary key, `name`, `createdAt`, with an index on `[createdAt]`.
  - `Bookmark`: Unique UUID primary key, `title`, `url`, `tags` (native PostgreSQL string array), `folderId`, `createdAt`.
  - **Relational Integrity**: `onDelete: Cascade` ensures that deleting a folder cleanly removes all nested bookmarks.
  - **Indexes**: Includes `@@index([folderId])` for fast folder lookups, `@@index([title])` for search, and a compound `@@index([createdAt, id])` for deterministic cursor-based pagination.
- **Migrations**: Generated strictly through Prisma's migration tooling:
  ```bash
  bun run gendb    # executes `bunx prisma migrate dev`
  ```

---

## Running Tests

The test suite includes both isolated resolver unit tests and an end-to-end integration test executed against the real PostgreSQL container in Docker.

```bash
# Run the complete test suite (Unit + Real PostgreSQL Integration)
bun test

# Run unit tests only
bun test tests/unit

# Run PostgreSQL integration test only (requires Docker running)
bun test tests/integration

# Run the complete Sanity check (Lint + Strict Typecheck + All Tests)
bun run sanity
```

---

## API Reference

### Queries

#### `folders: [Folder!]!`
Returns all folders sorted newest first.
```graphql
query {
  folders {
    id
    name
    createdAt
    bookmarks {
      id
      title
      url
    }
  }
}
```

#### `folder(id: ID!): Folder`
Returns a single folder by ID and its nested bookmarks.
```graphql
query GetFolder($id: ID!) {
  folder(id: $id) {
    id
    name
    bookmarks {
      id
      title
      url
      tags
    }
  }
}
```

#### `bookmarks(folderId: ID, search: String, take: Int, cursor: String): BookmarkConnection!`
Returns paginated bookmarks with optional folder filtering and case-insensitive substring title search.
```graphql
query GetBookmarks($folderId: ID, $search: String, $take: Int, $cursor: String) {
  bookmarks(folderId: $folderId, search: $search, take: $take, cursor: $cursor) {
    edges {
      cursor
      node {
        id
        title
        url
        tags
        folder {
          id
          name
        }
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
    totalCount
  }
}
```

---

### Mutations

#### `createFolder(name: String!): Folder!`
Creates a new folder after validating that the name is non-empty.
```graphql
mutation {
  createFolder(name: "Tech Articles") {
    id
    name
    createdAt
  }
}
```

#### `createBookmark(title: String!, url: String!, tags: [String!], folderId: ID!): Bookmark!`
Creates a new bookmark inside a folder with input validation (title and URL format).
```graphql
mutation {
  createBookmark(
    title: "GraphQL Documentation"
    url: "https://graphql.org"
    tags: ["graphql", "api"]
    folderId: "folder-uuid-here"
  ) {
    id
    title
    url
    tags
    folderId
  }
}
```

#### `updateBookmark(id: ID!, title: String, url: String, tags: [String!]): Bookmark!`
Updates provided fields on an existing bookmark.
```graphql
mutation {
  updateBookmark(
    id: "bookmark-uuid-here"
    title: "Updated GraphQL Docs"
  ) {
    id
    title
    url
  }
}
```

#### `deleteBookmark(id: ID!): Bookmark!`
Deletes a bookmark by ID. Throws `NOT_FOUND` if the bookmark does not exist.
```graphql
mutation {
  deleteBookmark(id: "bookmark-uuid-here") {
    id
    title
  }
}
```

#### `moveBookmark(id: ID!, folderId: ID!): Bookmark!`
Moves a bookmark to a different folder. Validates that both the bookmark and the destination folder exist.
```graphql
mutation {
  moveBookmark(
    id: "bookmark-uuid-here"
    folderId: "destination-folder-uuid"
  ) {
    id
    folderId
    folder {
      name
    }
  }
}
```

---

### Cursor-Based Pagination

Pagination follows the standard Relay Connection specification:
- **Cursor Encoding**: Cursors are opaque base64 strings encoding `createdAt::id` (e.g. `MjAyNi0wOC0yNl...`).
- **Deterministic Ordering**: Ordered by `createdAt DESC, id DESC`. The `id` tiebreaker prevents duplicate or skipped items when multiple bookmarks share the same timestamp.
- **Page Detection**: The resolver queries `take + 1` records. If `take + 1` records are returned, `pageInfo.hasNextPage` is `true`, and the extra item is sliced off.
- **End Cursor**: Pass `pageInfo.endCursor` into the `cursor` argument of the next query to retrieve the next page.

---

## Bonus Features

1. **Sanity Script (`bun run sanity`)**: Executes ESLint, TypeScript `tsc --noEmit`, and the full 22-test automated test suite in a single command.
2. **Containerized Service (`Dockerfile`)**: Production-ready multi-stage Bun container image for running the GraphQL API service independently.
3. **Continuous Integration (`.github/workflows/ci.yml`)**: Automated GitHub Actions workflow running linting, typechecking, and tests on PRs and pushes to `main`.

---

## How I'd Extend This

To keep within the required scope, intentional trade-offs were made. In a large-scale production environment, here is how this system would evolve:

1. **Authentication & Authorization**:
   - Implement JWT/OAuth2 session authentication via request headers.
   - Scope all `Folder` and `Bookmark` models to a `userId` foreign key.
   - Enforce row-level ownership checks in resolvers so users can only view and mutate their own data.
2. **Caching Layer (Redis)**:
   - Add Redis caching for frequently accessed folder trees and high-traffic bookmark lists.
   - Invalidate cache tags on bookmark creations, updates, or deletions.
3. **Advanced Full-Text Search**:
   - Introduce PostgreSQL `pg_trgm` (trigram) indexes or a dedicated search engine (such as Meilisearch or Elasticsearch) for typo-tolerant fuzzy search across titles, URLs, and tags.
4. **Observability & Telemetry**:
   - Integrate structured JSON logging (e.g. Winston / Pino) and OpenTelemetry tracing to track resolver execution times and database query latency.
   - Expose Prometheus metrics for request throughput and error rates.
5. **Database Connection Pooling**:
   - Deploy PgBouncer in front of PostgreSQL to handle high-concurrency connection pooling efficiently.
6. **API Evolution & Versioning**:
   - Use GraphQL `@deprecated` directives on fields when evolving the schema without breaking existing client integrations.
7. **Cursor `id` validation**: currently checked for non-empty only, not strict UUID format — malformed IDs fail gracefully via Prisma's own not-found handling rather than duplicating validation at the cursor layer.
