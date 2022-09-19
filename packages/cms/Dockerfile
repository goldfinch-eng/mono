FROM node:16-alpine

ENV NODE_ENV=production

# Set work directory
WORKDIR /app

# Copy project files
COPY package.json .
COPY package-lock.json .
COPY tsconfig.json .

# Copy project files
COPY . .

# Install globals
RUN npm install -g typescript
RUN npm install -g copyfiles
RUN npm install -g cross-env

# Install dependencies
RUN npm install

EXPOSE 3010

CMD ["npm","run","start:prod"]