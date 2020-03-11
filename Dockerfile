from node:11.9.0-alpine as js

workdir /app

copy package.json package-lock.json ./
run npm ci

copy . .
run npm run build


from python:3.7.3-alpine3.9 as py

workdir /app

copy requirements.txt .
run pip3 install --no-cache-dir -r requirements.txt \
&& rm -fr requirements.txt

copy --from=js /app/build build

copy server.py .

expose 5000
cmd FLASK_ENV=deployment python3 server.py
