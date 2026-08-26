import { createSchema, createYoga } from "graphql-yoga";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { join } from "node:path";
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
  landingPage: true,
});

// Start HTTP server on port 4000
const server = createServer(yoga);
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;

if (process.env.NODE_ENV !== "test") {
  server.listen(PORT, () => {
    console.log(`🚀 Bookmark Manager GraphQL API ready at http://localhost:${PORT}/graphql`);
  });
}

export { server };
