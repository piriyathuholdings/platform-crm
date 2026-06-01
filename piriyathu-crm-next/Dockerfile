FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

ARG FRAPPE_BASE_URL=http://api:9000
ARG NEXTJS_ORIGIN=https://crm.piriyathu.com
ENV FRAPPE_BASE_URL=$FRAPPE_BASE_URL
ENV NEXTJS_ORIGIN=$NEXTJS_ORIGIN
ENV NODE_ENV=production

RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start"]
