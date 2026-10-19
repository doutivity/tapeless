# Dev-only toolbox: Node (tests, checks, brand scripts), headless Chromium (screenshots, favicon/OG rendering)
# and Lighthouse. Nothing here ships to the browser or to GitHub Pages.
FROM node:alpine
RUN apk add --no-cache chromium font-noto font-noto-emoji python3 \
 && npm install -g lighthouse@12 --omit=dev --no-fund --no-audit
ENV CHROME_PATH=/usr/bin/chromium-browser
WORKDIR /app
