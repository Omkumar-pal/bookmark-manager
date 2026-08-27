# Bookmark Manager GraphQL API

A clean, robust, schema-first Bookmark Manager GraphQL API built with **Bun**, **TypeScript** (strict mode), **GraphQL Yoga**, **Prisma ORM**, and **PostgreSQL** running in Docker.

> 🧭 **New to this stack?** This README has troubleshooting boxes (⚠️) after every step that commonly trips people up. If a command doesn't produce the expected output shown, stop and check the box before moving to the next step — most setup issues cascade from one earlier silent failure.

---

## Table of Contents
- [Tech Stack](#tech-stack)
- [Architecture & Design Decisions](#architecture--design-decisions)
- [Setup & Local Development](#setup--local-development)
- [Environment Variables](#environment-variables)
- [Database & Migrations](#database--migrations)
- [Using GraphiQL](#using-graphiql)
- [Running Tests](#running-tests)
- [API Reference](#api-reference)
  - [Queries](#queries)
  - [Mutations](#mutations)
  - [Cursor-Based Pagination](#cursor-based-pagination)
- [Common Setup Problems](#common-setup-problems)
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
- [Docker Desktop](https://www.docker.com/) installed **and actually running** (see step 1 below — this is the #1 place beginners get stuck)
- **Nothing else already listening on port 5432 or 4000** — see [Common Setup Problems](#common-setup-problems) if you've ever installed Postgres directly on your machine before

### Quickstart (One-Command-At-A-Time Flow)

Run these **one at a time**, in order, and confirm each one's expected output before moving to the next.

#### 1. Make sure Docker Desktop is running

Open the Docker Desktop application first (search for it in your Start menu / Applications). Wait until its icon in the system tray stops animating and shows "Docker Desktop is running." This can take 30–60 seconds on first launch.

Confirm it's ready by running:
```bash
docker version
```
**Expected output:** you should see both a `Client` section and a `Server` section. If `Server` is missing or you get a connection error, Docker Desktop isn't fully started yet — wait longer or restart it.

> ⚠️ **If you see an error like** `unable to get image ... failed to connect to the docker API` **or** `dockerDesktopLinuxEngine: The system cannot find the file specified` **—** Docker Desktop is not running. This is not a project bug; it just means the Docker application itself needs to be opened and fully started before any `docker` command will work.

#### 2. Start the PostgreSQL container
```bash
docker compose up -d
```
**Expected output:** a line ending in `Started` or `Running` for the `bookmark_postgres` container, with no errors.

#### 3. Install dependencies
```bash
bun install
```

#### 4. Create your `.env` file

This project needs a file named exactly `.env` in the project's root folder (same folder as `package.json`). It doesn't exist yet — you create it by copying the provided template, `.env.example`.

**Option A — using a command (fastest):**
```bash
cp .env.example .env
```
> ⚠️ **On Windows Command Prompt (not PowerShell),** `cp` may not be recognized. Use this instead:
> ```bash
> copy .env.example .env
> ```

**Option B — doing it manually (if you're not comfortable with the command, or the command didn't seem to do anything):**
1. Open your project folder in File Explorer (or your code editor's file sidebar, e.g. VS Code).
2. Find the file named `.env.example` and open it in a text editor.
3. Select all its contents and copy them.
4. Create a brand-new file in the same folder. Name it **exactly** `.env` — note the leading dot and no file extension after it (not `.env.txt`).
   - In VS Code: right-click the project folder in the sidebar → "New File" → type `.env` and press Enter.
   - In Windows File Explorer: you may need "Show file name extensions" enabled first (View tab → check "File name extensions"), otherwise Windows may silently save it as `.env.txt`.
5. Paste the copied contents into your new `.env` file and save it.

**Either way, confirm it worked:**
```bash
type .env
```
(on Windows Command Prompt/PowerShell) or open the file in your editor. You should see something like:
```
DATABASE_URL=postgresql://bookmark_user:bookmark_pass@localhost:5432/bookmark_manager
PORT=4000
```

> 💡 **Why this file matters:** `.env` holds real configuration values (database connection string, port) that your app reads when it starts. It's intentionally excluded from Git (you won't see it tracked in version control) so that local secrets never get committed. In this project, the values already match `docker-compose.yml` by default — you shouldn't need to edit anything unless you changed `docker-compose.yml` yourself.

> ⚠️ **Can't see the `.env.example` file at all in File Explorer?** Files starting with a dot are sometimes hidden. Enable "Show hidden files" (Windows: View tab → check "Hidden items") or just use your code editor's file explorer instead, which usually shows dotfiles by default.

#### 5. Run Prisma database migrations
```bash
bun run gendb
```
**Expected output:** ends with `Your database is now in sync with your schema.` and `Generated Prisma Client...`.

> ⚠️ **If you see** `P1000: Authentication failed against database server` **—** this is almost never a typo in your password. See [Common Setup Problems → Authentication failed](#authentication-failed-p1000) below before touching your `.env` file.

#### 6. Start the development server
```bash
bun run dev
```
**Expected output:** a line like `Server ready at http://localhost:4000/graphql`. Keep this terminal window open — closing it stops your server.

> ⚠️ **If nothing prints, or the terminal just returns to the prompt with no server message** — the server crashed on startup or never started. Scroll up in the terminal for the actual error, and check that no other process is already using port 4000.

Once step 6 shows the "ready" message, open your browser to:

👉 **`http://localhost:4000/graphql`**

You should see the **GraphiQL** interactive playground load in the browser — not a blank page or JSON error.

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

> 💡 **Note:** if you ever need to fully reset your local database (wipe all data and re-apply migrations from scratch), run:
> ```bash
> docker compose down -v
> docker compose up -d
> bun run gendb
> ```
> The `-v` flag removes the database's stored data volume — useful after changing credentials in `docker-compose.yml`, since Postgres only reads those values the *first* time it initializes.

---

## Using GraphiQL

GraphiQL is the interactive playground built into GraphQL Yoga, loaded automatically at `http://localhost:4000/graphql` once your server is running.

**Layout you'll see:**
- **Left panel** — where you type your query or mutation.
- **Bottom-left tab strip** — look for a tab labeled **"Variables"** (sometimes collapsed; click it to expand). This is where you provide values for any `$variableName` used in your query.
- **Play button** (▶, usually top-center) — runs the query.
- **Right panel** — shows the JSON response.

**Example — running a query with a variable:**

Query (left panel):
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

Variables (bottom-left "Variables" tab):
```json
{
  "id": "paste-a-real-folder-id-here"
}
```

> 💡 **Don't have a folder ID yet?** Run the `createFolder` mutation from the [Mutations](#mutations) section first, copy the `id` it returns, and paste that into the Variables panel above.

> 💡 **Prefer to skip the Variables panel while testing?** You can hardcode the value directly in the query instead:
> ```graphql
> query {
>   folder(id: "paste-a-real-folder-id-here") {
>     id
>     name
>   }
> }
> ```

### Running mutations in GraphiQL

There is no separate "mutations panel" — mutations go in the **exact same left-hand editor** as queries. The only difference is the keyword you start with: `mutation` instead of `query`.

**Steps:**
1. Clear out whatever query is currently in the left editor panel (select all, delete).
2. Type a mutation directly, starting with the word `mutation`, for example:
   ```graphql
   mutation {
     createFolder(name: "Tech Articles") {
       id
       name
       createdAt
     }
   }
   ```
3. Click the same ▶ (play/execute) button you used for queries.
4. The response — including the new `id` GraphQL just generated — appears in the right-hand panel. **Copy that `id`** if you plan to use it in a follow-up query or mutation (e.g. `createBookmark` needs a real `folderId`).

**If your mutation also needs variables** (like `updateBookmark` needing an `id`), it works exactly like the query example above — declare the variable in the mutation signature, then fill it in in the same "Variables" tab:
```graphql
mutation UpdateBookmark($id: ID!, $title: String) {
  updateBookmark(id: $id, title: $title) {
    id
    title
  }
}
```
Variables panel:
```json
{
  "id": "paste-the-real-bookmark-id-here",
  "title": "Updated GraphQL Docs"
}
```

> ⚠️ **Common confusion:** if you paste a `mutation { ... }` block while the editor still has leftover `query { ... }` text above or below it, GraphiQL will show a syntax error like "Syntax Error: Expected Name". Make sure only **one** operation (one query or one mutation block) is in the editor at a time, unless you've explicitly named both operations and select which one to run from a dropdown that appears near the play button.

> 💡 **Typical workflow to test the full API by hand:** run `createFolder` first → copy the returned `id` → use it as `folderId` in `createBookmark` → copy the new bookmark's `id` → use that to test `updateBookmark`, `moveBookmark`, or `deleteBookmark`.

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

## Common Setup Problems

### Authentication failed (P1000)

If `bun run gendb` fails with:
```
Error: P1000: Authentication failed against database server, the provided database credentials for `bookmark_user` are not valid.
```
This almost always means **something other than this project's Docker container is already using port 5432** — most commonly a Postgres instance installed directly on your machine (common on Windows if you've ever installed Postgres via an installer for another project).

**How to check:**
```bash
netstat -ano | findstr :5432
```
Note the PID(s) in the last column, then check what they are:
```bash
tasklist /FI "PID eq <PID_NUMBER>"
```
(replace `<PID_NUMBER>` with the actual number — not the whole line)

- If it shows `com.docker.backend.exe` — that's fine, that's Docker itself.
- If it shows `postgres.exe` — that's a locally installed Postgres competing for the same port.

**Fix — stop the local Postgres service(s):**
```bash
sc queryex type= service state= all | findstr /i postgres
```
This lists installed Postgres services (e.g. `postgresql-x64-13`, `postgresql-x64-18`). Stop each one (as Administrator):
```bash
net stop postgresql-x64-13
net stop postgresql-x64-18
```
Then re-run the setup from step 2:
```bash
docker compose down -v
docker compose up -d
bun run gendb
```

> 💡 To stop these services from auto-starting and causing this again on your next reboot:
> ```bash
> sc config postgresql-x64-13 start= demand
> sc config postgresql-x64-18 start= demand
> ```
> This doesn't uninstall them — it just stops them from grabbing port 5432 automatically before Docker gets a chance.

### GraphiQL page won't load / nothing happens at `localhost:4000/graphql`

1. Confirm the dev server is actually running — check your terminal for `Server ready at http://localhost:4000/graphql`.
2. If your terminal shows no server message at all, check what's using port 4000:
   ```bash
   netstat -ano | findstr :4000
   ```
   If nothing is listed, the server isn't running yet — go back to step 6 of setup and run `bun run dev`.
3. Make sure you're visiting `/graphql` specifically, not just `localhost:4000`.

---

## Bonus Features

1. **Sanity Script (`bun run sanity`)**: Executes ESLint, TypeScript `tsc --noEmit`, and the full 28-test automated test suite in a single command.
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
