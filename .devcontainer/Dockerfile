FROM mcr.microsoft.com/devcontainers/base:ubuntu-24.04

RUN apt-get update && apt-get install -y \
    chromium-browser \
    xvfb \
    x11-utils \
    fonts-liberation \
    libasound2t64 \
    && rm -rf /var/lib/apt/lists/*

ENV CHROMIUM_FLAGS="--no-sandbox --disable-dev-shm-usage"
