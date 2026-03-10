# Multi-stage Dockerfile for Angular 19 Application
# Development-focused build due to Tailwind CSS 4.0 compatibility issues

# Stage 1: Base Node.js image
FROM node:22-alpine AS base
WORKDIR /app

# Stage 2: Dependencies
FROM base AS dependencies
COPY package.json package-lock.json ./
# Use npm ci for reproducible builds with exact versions from package-lock.json
RUN npm ci --legacy-peer-deps && npm cache clean --force

# Stage 3: Development (DEFAULT)
FROM base AS development
COPY package.json package-lock.json ./
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
EXPOSE 4200
CMD ["npm", "start", "--", "--host", "0.0.0.0", "--poll", "2000"]

# Stage 4: Build for production
# NOTE: This stage may fail with Tailwind CSS 4.0 due to CSS generation issues
# For production builds, consider:
# 1. Building locally first: npm run build
# 2. Using the pre-built files with production-local stage
# 3. Downgrading to Tailwind CSS 3.x
FROM base AS build
COPY package.json package-lock.json ./
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN npm run build

# Stage 5: Production with Nginx (using build stage)
FROM nginx:alpine AS production
COPY --from=build /app/dist/appdarkmode/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

# Stage 6: Production with pre-built files (alternative)
# Use this if you build locally first
FROM nginx:alpine AS production-local
COPY dist/appdarkmode/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
