FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
# Install devDependencies too; Coolify may inject NODE_ENV=production at build time.
RUN npm ci --include=dev

COPY . .

ARG FRAPPE_BASE_URL=http://api:9000
ARG NEXTJS_ORIGIN=https://crm.piriyathu.com
ENV FRAPPE_BASE_URL=$FRAPPE_BASE_URL
ENV NEXTJS_ORIGIN=$NEXTJS_ORIGIN

RUN npm run build

ENV NODE_ENV=production

EXPOSE 3000

CMD ["npm", "run", "start"]
