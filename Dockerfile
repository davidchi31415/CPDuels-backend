FROM node:alpine

WORKDIR /usr/app

RUN apk --no-cache upgrade && apk add --no-cache chromium coreutils xvfb xvfb-run
RUN export DISPLAY=:0
RUN /usr/bin/Xvfb :0 -screen 0 1024x768x24 &

RUN sleep 5

COPY . .
RUN npm install

CMD ['xvfb-run -a --server-args="-screen 0 1280x800x24 -ac -nolisten tcp -dpi 96 +extension RANDR"', "node", "server.js"]