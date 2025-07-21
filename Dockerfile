FROM oven/bun:1.2.10-alpine AS build

WORKDIR /app

# Install dependencies
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy source code
COPY lib ./lib
COPY src ./src

# Build application
RUN bun build \
    --compile \
    --minify-whitespace \
    --minify-syntax \
    --target bun \
    --outfile server \
    ./src/index.ts


FROM alpine:3.22 AS runtime

RUN apk update && apk add gcompat libstdc++ libgcc zlib icu

WORKDIR /app

# Copy the compiled executable
COPY --from=build /app/server .

# Expose the port your Elysia app listens on (default is 3000)
EXPOSE 3000

# Command to run your compiled Elysia application
CMD ["./server"]