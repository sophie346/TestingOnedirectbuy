# OneDirectBuy flow control plane + Playwright runner
# Image: gcr.io/gentle-epoch-277301/onetest:latest
# UI:      https://onetest.onechanneladmin.com
# Backend: https://dev-onetest.onechanneladmin.com
FROM mcr.microsoft.com/playwright:v1.57.0-jammy

WORKDIR /app

ENV NODE_ENV=production \
    PORT=8080 \
    HOST=0.0.0.0 \
    HEADLESS=true \
    PW_HEADLESS=1 \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    STATUS_API_URL=http://127.0.0.1:8080

COPY package.json package-lock.json ./
# Keep devDependencies — @playwright/test is required to run flows.
RUN npm ci \
  && npx playwright install chromium \
  && npm cache clean --force

COPY . .

# Writable dirs for reports / live step feeds / exit markers
RUN mkdir -p reports/live-steps test-results \
  && chown -R pwuser:pwuser /app

USER pwuser

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8080/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/index.js"]
