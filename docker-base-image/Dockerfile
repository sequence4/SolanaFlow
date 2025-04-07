FROM node:18-bullseye-slim

RUN apt-get update && apt-get install -y \
  git \
  python3 \
  build-essential \
  curl \
  coreutils \
  procps \
  grep \
  pkg-config \
  libssl-dev \
  && rm -rf /var/lib/apt/lists/*

RUN curl -sSfL https://release.solana.com/v1.17.0/install | sh
ENV PATH="/root/.local/share/solana/install/active_release/bin:${PATH}"

RUN curl https://sh.rustup.rs -sSf | bash -s -- -y --default-toolchain 1.82.0
ENV PATH="/root/.cargo/bin:${PATH}"

RUN cargo install --git https://github.com/coral-xyz/anchor --tag v0.30.1 anchor-cli

RUN corepack enable

RUN npm install -g \
  typescript@4.9.5 \
  rollup@3.2.5 \
  @rollup/plugin-commonjs@23.0.2 \
  @rollup/plugin-json@4.1.0 \
  @rollup/plugin-node-resolve@15.0.1 \
  @rollup/plugin-typescript@11.0.0 \
  create-react-app@5.0.1 \
  @solana/web3.js@1.73.0

WORKDIR /usr/src
