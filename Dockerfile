FROM node:alpine

WORKDIR /usr/app

COPY . .
RUN npm install
RUN sudo apt-get install chromium-browser

CMD ["npm", "start"]