FROM node:22-slim

# sodium-native and @discordjs/opus need build tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ libopus-dev libsodium-dev \
    && rm -rf /var/lib/apt/lists/*

RUN useradd -m voxbot

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

RUN chown -R voxbot:voxbot /app

USER voxbot

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
    CMD node -e "const fs=require('fs'); try { const age=Date.now()-Number(fs.readFileSync('/tmp/vox-heartbeat','utf8')); process.exit(age<90000?0:1); } catch(e) { process.exit(0); }"

CMD ["node", "index.js"]
