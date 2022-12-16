FROM node:16

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
RUN npm install -g yarn
RUN npm install -g typescript
RUN npm install -g copyfiles
RUN npm install -g cross-env
RUN npm install -g ts-node

# Install dependencies
RUN yarn install

CMD ["yarn","start:prod"]