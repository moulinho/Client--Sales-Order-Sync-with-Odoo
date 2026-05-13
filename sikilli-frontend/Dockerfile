FROM node:20 AS builder

WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install

COPY . .
RUN yarn build


FROM node:20

WORKDIR /app

COPY --from=builder /app .

CMD ["yarn", "start"]