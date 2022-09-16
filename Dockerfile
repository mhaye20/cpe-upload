FROM node:lts-buster

# Create app directory
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

# Install forever CLI
RUN npm install -g forever

# Install app dependencies
COPY package.json /usr/src/app
COPY yarn.lock /usr/src/app
RUN yarn install

# Bundle app source
COPY . /usr/src/app

# Expose port
EXPOSE 9090

# Run
CMD [ "forever", "index.mjs" ]