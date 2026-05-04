FROM mcr.microsoft.com/devcontainers/base:ubuntu-24.04

RUN apt-get update && apt-get install -y \
    apt-transport-https \
    ca-certificates \
    chromium-browser \
    curl \
    gnupg \
    xvfb \
    x11-utils \
    fonts-liberation \
    libasound2t64 \
    && curl https://packages.cloud.google.com/apt/doc/apt-key.gpg \
      | gpg --dearmor -o /usr/share/keyrings/cloud.google.gpg \
    && echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" \
      > /etc/apt/sources.list.d/google-cloud-sdk.list \
    && apt-get update \
    && apt-get install -y google-cloud-cli \
    && rm -rf /var/lib/apt/lists/*

ENV CHROMIUM_FLAGS="--no-sandbox --disable-dev-shm-usage"
