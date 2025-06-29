FROM nginx:alpine

RUN apk update && apk add --no-cache openssl

RUN mkdir -p /etc/nginx/certs

RUN openssl req -x509 -nodes -days 3650 \
    -newkey rsa:2048 \
    -keyout /etc/nginx/certs/dukong.net.key \
    -out /etc/nginx/certs/dukong.net.crt \
    -subj "/C=BR/ST=SomeState/L=SomeCity/O=MyOrg/CN=dukong.net"

COPY conf/nginx.conf /etc/nginx/nginx.conf

# (Optional) expose ports
EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
