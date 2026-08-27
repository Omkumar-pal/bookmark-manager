import { createSchema, createYoga } from "graphql-yoga";
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join, extname } from "node:path";
import { prisma } from "./lib/prisma.js";
import { resolvers } from "./resolvers/index.js";
import type { GraphQLContext } from "./types/context.js";

// Load the schema-first .graphql definition
const typeDefs = readFileSync(join(import.meta.dir, "schema", "typeDefs.graphql"), "utf-8");

// Build executable GraphQL schema
const schema = createSchema<GraphQLContext>({
  typeDefs,
  resolvers,
});

// Create GraphQL Yoga instance with Prisma context injection
export const yoga = createYoga<GraphQLContext>({
  schema,
  context: (): GraphQLContext => ({
    prisma,
  }),
  graphqlEndpoint: "/graphql",
  landingPage: false,
});

const mimeTypes: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

// Start HTTP server on port 4000
const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost:4000"}`);

  // GraphQL endpoint
  if (url.pathname.startsWith("/graphql")) {
    return yoga(req, res);
  }

  // Static Frontend UI handling
  const publicDir = join(import.meta.dir, "..", "public");
  let filePath = join(publicDir, url.pathname === "/" ? "index.html" : url.pathname.slice(1));

  if (!existsSync(filePath) && url.pathname === "/") {
    filePath = join(publicDir, "index.html");
  }

  if (existsSync(filePath)) {
    const ext = extname(filePath);
    const contentType = mimeTypes[ext] ?? "text/plain";
    const content = readFileSync(filePath);
    res.writeHead(200, { "Content-Type": contentType });
    res.end(content);
    return;
  }

  // Fallback to GraphQL Yoga
  return yoga(req, res);
});

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;

if (process.env.NODE_ENV !== "test") {
  server.listen(PORT, () => {
    console.log(`🚀 Bookmark Manager GraphQL API ready at http://localhost:${PORT}/graphql`);
    console.log(`✨ Visual Frontend Dashboard ready at http://localhost:${PORT}/`);
  });
}

export { server };
