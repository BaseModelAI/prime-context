FROM node:22.22.1-bookworm AS base

ARG PRIME_AGENT_VERSION=0.8.1
ARG IMAGE_REVISION=6
ENV DEBIAN_FRONTEND=noninteractive \
    PRIME_AGENT_KERNEL_VENV=/opt/prime-agent-kernel \
    UV_PYTHON_INSTALL_DIR=/opt/uv-python \
    UV_CACHE_DIR=/tmp/uv-cache

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        bash build-essential ca-certificates curl fd-find findutils git jq patch procps \
        python3 python3-pip python3-venv python-is-python3 ripgrep unzip \
    && ln -s /usr/bin/fdfind /usr/local/bin/fd \
    && rm -rf /var/lib/apt/lists/*

RUN curl -LsSf https://astral.sh/uv/0.10.12/install.sh \
    | env UV_INSTALL_DIR=/usr/local/bin sh

RUN curl -fsSL https://app.primeintellect.ai/prime-agent/install.sh \
    | env PRIME_AGENT_VERSION="$PRIME_AGENT_VERSION" \
        PRIME_AGENT_BOOTSTRAP_KERNEL_ON_INSTALL=1 sh \
    && prime-agent --help >/dev/null \
    && for pyproject in /usr/local/lib/node_modules/prime-agent/dist/skills/*/pyproject.toml; do \
        set -- "$@" --editable "${pyproject%/*}"; \
       done \
    && uv pip install --python /opt/prime-agent-kernel/bin/python "$@" \
    && /opt/prime-agent-kernel/bin/python -c \
        "import agent_message, agent_observe, attach_image, bs4, compact, dill, dotenv, edit, goal, httpx, ipykernel, linear, lxml, notion, numpy, pandas, pydantic, refine, requests, rlm, rlm_heartbeat, scipy, tomli, tyro, websearch, yaml; assert callable(goal.complete)" \
    && rm -rf /root/.npm /tmp/uv-cache

COPY patch-prime-agent.mjs smoke-prime-agent.mjs type-smoke-prime-agent.ts /usr/local/share/prime-context-benchmark/
RUN node /usr/local/share/prime-context-benchmark/patch-prime-agent.mjs \
    && node /usr/local/share/prime-context-benchmark/patch-prime-agent.mjs \
    && node /usr/local/share/prime-context-benchmark/patch-prime-agent.mjs --check \
    && node /usr/local/share/prime-context-benchmark/smoke-prime-agent.mjs \
    && typecheck_dir="$(mktemp -d)" \
    && cp /usr/local/share/prime-context-benchmark/type-smoke-prime-agent.ts "$typecheck_dir/type-smoke-prime-agent.ts" \
    && ln -s /usr/local/lib/node_modules/prime-agent/node_modules "$typecheck_dir/node_modules" \
    && printf '%s\n' \
        '{' \
        '  "compilerOptions": {' \
        '    "strict": true,' \
        '    "skipLibCheck": true,' \
        '    "noEmit": true,' \
        '    "module": "NodeNext",' \
        '    "moduleResolution": "NodeNext",' \
        '    "target": "ES2022",' \
        '    "baseUrl": "/",' \
        '    "paths": {' \
        '      "@earendil-works/pi-coding-agent": ["/usr/local/lib/node_modules/prime-agent/dist/index.d.ts"]' \
        '    }' \
        '  },' \
        '  "files": ["type-smoke-prime-agent.ts"]' \
        '}' > "$typecheck_dir/tsconfig.json" \
    && (cd "$typecheck_dir" \
        && npm_config_cache=/tmp/prime-context-type-smoke-npm \
            npx --yes --package=typescript@5.9.3 tsc --noEmit --project tsconfig.json) \
    && rm -rf "$typecheck_dir" /tmp/prime-context-type-smoke-npm /root/.npm

ENV PRIME_AGENT_KERNEL_PYTHON=/opt/prime-agent-kernel/bin/python \
    PATH=/usr/local/bin:/usr/bin:/bin
LABEL org.prime-context.benchmark="true" \
      org.prime-context.variant="base" \
      org.prime-context.prime-agent-version="$PRIME_AGENT_VERSION" \
      org.prime-context.image-revision="$IMAGE_REVISION"

FROM base AS vanilla
LABEL org.prime-context.variant="vanilla"

FROM vanilla AS published
ARG PUBLISHED_CONTEXT_VERSION=6.3.4
ARG PLUGIN_IMAGE_REVISION=1
RUN PRIME_AGENT_CODING_AGENT_DIR=/tmp/prime-agent-package-config \
        prime-agent package install "npm:prime-agent-context@$PUBLISHED_CONTEXT_VERSION" \
    && ln -s "$(npm root -g)/prime-agent-context" /opt/prime-context \
    && set -- \
    && for pyproject in $(find /opt/prime-context -path '*/node_modules' -prune -o -name pyproject.toml -print); do \
        set -- "$@" --editable "${pyproject%/*}"; \
       done \
    && if [ "$#" -gt 0 ]; then uv pip install --python /opt/prime-agent-kernel/bin/python "$@"; fi \
    && test -f /opt/prime-context/dist/index.js \
    && rm -rf /tmp/prime-agent-package-config /root/.npm /tmp/uv-cache
LABEL org.prime-context.variant="published" \
      org.prime-context.prime-context-version="$PUBLISHED_CONTEXT_VERSION" \
      org.prime-context.plugin-image-revision="$PLUGIN_IMAGE_REVISION"

FROM vanilla AS progressive
ARG PROGRESSIVE_CONTEXT_VERSION=working
ARG PLUGIN_IMAGE_REVISION=1
COPY prime-agent-context-progressive.tgz /tmp/prime-agent-context-progressive.tgz
RUN mkdir -p /opt/prime-context \
    && tar -xzf /tmp/prime-agent-context-progressive.tgz --strip-components=1 -C /opt/prime-context \
    && PRIME_AGENT_CODING_AGENT_DIR=/tmp/prime-agent-package-config \
        prime-agent package install /opt/prime-context \
    && set -- \
    && for pyproject in $(find /opt/prime-context -path '*/node_modules' -prune -o -name pyproject.toml -print); do \
        set -- "$@" --editable "${pyproject%/*}"; \
       done \
    && if [ "$#" -gt 0 ]; then uv pip install --python /opt/prime-agent-kernel/bin/python "$@"; fi \
    && test -f /opt/prime-context/dist/index.js \
    && rm -rf /tmp/prime-agent-package-config /tmp/prime-agent-context-progressive.tgz /root/.npm /tmp/uv-cache
LABEL org.prime-context.variant="progressive" \
      org.prime-context.prime-context-version="$PROGRESSIVE_CONTEXT_VERSION" \
      org.prime-context.plugin-image-revision="$PLUGIN_IMAGE_REVISION"
