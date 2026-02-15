# Build stage
FROM rust:1.75-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache musl-dev pkgconfig openssl-dev openssl-libs-static

# Copy Cargo files
COPY Cargo.toml Cargo.lock ./

# Create dummy src for caching dependencies
RUN mkdir -p src && echo "fn main() {}" > src/main.rs
RUN cargo build --release
RUN rm -rf src

# Copy actual source
COPY . .

# Build actual application
RUN touch src/main.rs && cargo build --release

# Production stage
FROM alpine:3.19

RUN apk add --no-cache ca-certificates

WORKDIR /app

# Copy binary
COPY --from=builder /app/target/release/wired_in_gateway .

EXPOSE 8080

ENV PORT=8080
ENV RUST_LOG=info

CMD ["./wired_in_gateway"]
