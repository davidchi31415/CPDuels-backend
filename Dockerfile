FROM node:alpine

WORKDIR /usr/app

RUN apk update && \
    apk add install -y xvfb
RUN export DISPLAY=:0
RUN /usu/bin/Xvfb :0 -screen 0 1024x768x24 &

RUN sleep 5

COPY . .
RUN npm install

CMD ["xvfb", "node", "server.js"]