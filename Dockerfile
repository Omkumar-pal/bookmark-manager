FROM oven/bun:1 AS base
WORKDIR /app

# Copy dependency manifests
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy source code and Prisma schema
COPY . .

# Generate typed Prisma Client inside the container
RUN bunx prisma generate

# Expose GraphQL Yoga default port
EXPOSE 4000

# Start GraphQL server
CMD ["bun", "run", "src/index.ts"]
