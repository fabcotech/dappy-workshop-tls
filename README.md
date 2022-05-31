# Prerequistes

Install docker : https://docs.docker.com/engine/install/

Install docker compose plugin: https://docs.docker.com/compose/install/

Following command should display docker compose version: 
```sh
docker compose version
# Docker Compose version v2.0.0-beta.6
```

Install nodejs > 16: https://nodejs.org/en/download/

Install dappy-cli
```sh
npm i -g @fabcotech/dappy-cli
```
Install dappy-lookup
```sh
npm i -g @fabcotech/dappy-lookup
```
## Run dappy-node locally

Install globally @fabcotech/dappy-node package

```sh
npm i -g @fabcotech/dappy-node
```

Create .rnode folder with genesis block

```sh
easyrnode init
```

Run local rnode, propose blocks, and redis using docker and docker-compose 

```sh
easyrnode run
# wait for the "Listening for traffic" log
```

Deploy Dappy name system on local rnode

```sh
dappy-deploy-name-system
```

Run dappy-node with DOH endpoint

```sh
DAPPY_NODE_HTTPS_PORT=3002 dappy-node
```

Trust `dappynode.crt` certificate to be able to use dappy-node DOH server with chrome

- Only for OSX, trust dappy-node certificate 

```sh
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain dappynode.crt
```

- Only for Chromium on Linux:

https://superuser.com/questions/1296596/how-can-i-get-chrome-accepting-self-signed-certificates

- Only for Ubuntu/Debian (curl):

```sh
sudo apt-get install -y ca-certificates
sudo cp dappynode.crt /usr/local/share/ca-certificates
sudo update-ca-certificates
```

Others OS: https://support.kerioconnect.gfi.com/hc/en-us/articles/360015200119-Adding-Trusted-Root-Certificates-to-the-Server

# DEMO 1: Publish company website on dappy name system

## Run a nginx not secured

Run nginx in a container
```sh
docker run --rm --name company \
    -v $(pwd)/1-publish/nginx-http.conf:/etc/nginx/nginx.conf \
    -p 80:80 \
    nginx \
    nginx-debug -g 'daemon off;'
```
Test connectivity
```sh
curl http://127.0.0.1
```

## Publish www.company.dappy IPs to dappy name system

Publish company.dappy A and AAAA records on dappy name system
Publish also google.com A record (needed for Google Chrome)

```sh
cat << EOF > dappy.config.json
{
  "zones": [
    {
      "origin": "company",
      "ttl": 3600,
      "records": [
        {
          "name": "www",
          "type": "A",
          "data": "127.0.0.1"
        },
        {
          "name": "www",
          "type": "AAAA",
          "data": "::1"
        }        
      ]
    },
    {
      "origin": "com",
      "ttl": 3600,
      "records": [
        {
          "name": "google",
          "type": "A",
          "data": "127.0.0.1"
        }
      ]      
    }    
  ]
}
EOF
```
Push company zone to dappy name system
```sh
dappy-cli pushzones
```

Confirm that www.company.dappy A record is published
```sh
dappy-lookup www.company.dappy A --endpoint=http://127.0.0.1:3001
```

## Visit http://www.company.dappy with curl

Visit http://www.company.dappy using curl and dappy-node DOH server

```sh
curl --cacert dappynode.crt --doh-url https://localhost:3002/dns-query http://www.company.dappy
```

## Visit http://www.company.dappy with chrome

Configure Chrome/Chromium with DNS Over HTTPS server, chrome setting address is probably chrome://settings/security "Secure DNS" , choose "custom" and input https://localhost:3002/dns-query

```sh 
# Visit http://www.company.dappy
```

Should display `Success over HTTP (port 80) !!!`.

**Congratulations !!** You completed demo 1, your web application now has the following properties :
- 🔐 Blockchain + dappy name system instead of the DNS
- 🔐 DNS over HTTPS for service discovery (and co-resolution by the dappy network in production environment)
- 🤕 Right now it is simply accessed over HTTP (without encryption), continue to demo 2 and 3 to expose over HTTPS !

# DEMO 2: Secure communication with TLS and use Dappy to distribute server certificate 

## Publish www.company.dappy certificate

Create a company.key private key for www.company.dappy domain. We will use this key to generate certificates.

```sh
openssl ecparam -name prime256v1 -genkey -noout -out company.key
```

Create www.company.dappy certificate

```sh
openssl req \
  -new \
  -sha256 \
  -nodes \
  -x509 \
  -key company.key \
  -out company.crt \
  -days 365 \
  -subj /CN=company.dappy \
  -extensions san \
  -config <( \
    echo '[req]'; \
    echo 'distinguished_name=req'; \
    echo '[san]'; \
    echo 'basicConstraints = critical, CA:TRUE'; \
    echo 'subjectAltName=DNS.1:www.company.dappy';)
```
Publish www.company.dappy certificate on dappy
```sh
cat << EOF > dappy.config.json
{
  "zones": [
    {
      "origin": "company",
      "ttl": 3600,
      "records": [
        {
          "name": "www",
          "type": "CERT",
          "data": "$(openssl base64 -A -in company.crt)"
        },
        {
          "name": "www",
          "type": "A",
          "data": "127.0.0.1"
        },
        {
          "name": "www",
          "type": "AAAA",
          "data": "::1"
        }        
      ]
    }
  ]
}
EOF
```

Push www.company.dappy on dappy
```sh
dappy-cli pushzones
```

Confirm that www.company.dappy CERT is published on dappy
```sh
dappy-lookup www.company.dappy CERT --endpoint=https://127.0.0.1:3002 --cacert=dappynode.crt --hostname=localhost
```

## Enable TLS and run www.company.dappy using nginx

Run nginx in a container

```sh
docker run --rm --name company \
    -v $(pwd)/2-tls-server/nginx-tls-server.conf:/etc/nginx/nginx.conf \
    -v $(pwd)/company.key:/etc/nginx/company-key.pem \
    -v $(pwd)/company.crt:/etc/nginx/company.pem \
    -p 80:80 \
    -p 443:443 \
    nginx \
    nginx-debug -g 'daemon off;'
```

## Visit https://www.company.dappy with curl

Concatenate dappy-node and www.company.dappy certificates for curl.

```sh
cat << EOF > certs.pem
`cat dappynode.crt`
`cat company.crt`
EOF
```

Visit https://www.company.dappy using curl and resolving name with dappy-node DOH server

```sh
curl --cacert certs.pem --doh-url https://localhost:3002/dns-query https://www.company.dappy
```

## Visit https://www.company.dappy with chrome 

Trust certificate `company.crt` with one of these solutions

- Only for OSX, trust dappy-node certificate 

```sh
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain company.crt
```

- Only for Chromium on Linux:

https://superuser.com/questions/1296596/how-can-i-get-chrome-accepting-self-signed-certificates

Using chrome, visit https://www.company.dappy

Should display `Success over HTTPS (port 443) !!!`

Chrome resolved wwww.company.dappy using dappy-node DOH server and Dappy name system using a TLS connection

**Congratulations !!** You completed demo 2, your web application is secure in many ways 😛😛 :
- 🔐 Blockchain + dappy name system instead of the DNS and Certificate Authorities (TLS)
- 🔐 DNS over HTTPS for service discovery (and co-resolution by the dappy network in production environment)
- 🔐 Accessed over HTTPS !

# DEMO 3: Authenticate clients using custom CA

## Create client certificate and sign it with custom CA

Create client key

```sh
openssl ecparam -name prime256v1 -genkey -noout -out client.key
```

Generate client CSR (Certificate Signing Request)

```sh
openssl req \
  -new \
  -sha256 \
  -nodes \
  -key client.key \
  -out client.csr \
  -subj /CN=client.dappy
```

Sign client CSR using www.company.dappy certificate

```sh
openssl x509 \
  -req \
  -sha256 \
  -CA company.crt \
  -CAkey company.key \
  -in client.csr \
  -out client.crt \
  -days 365 \
  -CAcreateserial
```

## Enable client certicate validation using dappy on nginx

In a dedicated terminal
```sh
cd verifysig
```
Create verifysig key and certificate
```
openssl ecparam -name prime256v1 -genkey -noout -out verifysig.key 
openssl req -new -x509 -key verifysig.key -out verifysig.crt -subj /CN=verifysig
```

Start verifisig middleware
```
npm i
npm start
```

Run nginx in a container

```sh
docker run --rm --name company \
    -v $(pwd)/3-tls-client/nginx-tls-client.conf:/etc/nginx/nginx.conf \
    -v $(pwd)/company.key:/etc/nginx/company-key.pem \
    -v $(pwd)/company.crt:/etc/nginx/company.pem \
    -v $(pwd)/3-tls-client/dappy.js:/etc/nginx/njs/dappy.js \
    -p 80:80 \
    -p 443:443 \
    --add-host=host.docker.internal:host-gateway \
    nginx \
    nginx-debug -g 'daemon off;'
```

Navigate to https://www.company.dappy using client certificate

```sh
curl https://www.company.dappy \
  --cacert certs.pem \
  --doh-url https://localhost:3002/dns-query \
  --key client.key \
  --cert client.crt
```

Should display `Success over HTTPS (port 443) and client authenticated !!!`

**Congratulations !!** You completed demo 3 🎇🎈🎇🎈, your web application is now one of the most secure in the world, the security properties :
- 🔐 Blockchain + dappy name system instead of the DNS and Certificate Authorities (TLS)
- 🔐 DNS over HTTPS for service discovery (and co-resolution by the dappy network in production environment)
- 🔐 Accessed over HTTPS !
- 🔐 The web server authenticates the clients with TLS. Just like the client authenticates the server !
