FROM node:16

ENV NODE_ENV=production

# Set work directory
WORKDIR /app

# Copy project files
COPY . .

# Install dependencies
RUN yarn plugin import workspace-tools
RUN yarn workspaces focus @goldfinch-eng/cms

WORKDIR packages/cms

CMD ["yarn","start:prod"]