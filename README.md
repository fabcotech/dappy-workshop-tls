# Prerequistes

## Install dappy-cli: `npm i -g @fabcotech/dappy-cli`
## Install dappy-lookup: `npm i -g @fatcotech/dappy-lookup`
## Run dappy-node locally

```sh
# Install globally @fabcotech/dappy-node package
npm i -g @fabcotech/dappy-node
# Create .rnode folder with genesis block
easyrnode init
# Run local rnode, propose blocks, and redis using docker and docker-compose 
easyrnode run 
# Deploy Dappy name system on local rnode
dappy-deploy-name-system
# Run dappy-node in HTTPS
DAPPY_NODE_HTTPS_PORT=3002 dappy-node
# Trust dappy-node certificate to be able to use dappy-node DOH server with chrome
  # OSX only, trust dappy-node certificate 
  sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain dappynode.crt
  # Others OS: https://support.kerioconnect.gfi.com/hc/en-us/articles/360015200119-Adding-Trusted-Root-Certificates-to-the-Server
```

# DEMO 1: Publish company website on dappy name system

## Run a nginx not secured

Run nginx
```sh
# Run nginx in a container
docker run --rm --name company \
    -v $(pwd)/1-publish/nginx-http.conf:/etc/nginx/nginx.conf \
    -p 80:80 \
    nginx \
    nginx-debug -g 'daemon off;'

# Test connectivity
curl http://127.0.0.1
```

## Publish www.company.dappy IPs to dappy name system

```sh
# Publish company.dappy A and AAAA records on dappy@
# Publish also google.com A record (needed for Google Chrome)
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

# Push company zone to dappy name system
dappy-cli pushzones 

# Confirm that www.company.dappy A record is published
dappy-lookup www.company.dappy A --endpoint=http://127.0.0.1:3001
```

## Visit http://www.company.dappy with curl

```sh
# Visit http://www.company.dappy using curl and dappy-node DOH server
curl --cacert dappynode.crt --doh-url https://localhost:3002/dns-query http://www.company.dappy
```

## Visit http://www.company.dappy with chrome

```sh 
# Configure chrome DOH to https://localhost:3002/dns-query
# Visit http://company.dappy
# Should display Success !!!

# Congrats ! Chrome resolved company.dappy using dappy DOH server and Dappy name system
```

# DEMO 2: Secure communication with TLS and use Dappy to distribute server certificate 

## Publish www.company.dappy certificate

```sh
# Create www.company.dappy key
openssl ecparam -name secp256r1 -genkey -noout -out company-key.pem

# Create www.company.dappy certificate
openssl req \
  -new \
  -x509 \
  -key company-key.pem \
  -out company.pem -days 365 \
  -subj /CN=company.dappy \
  -extensions san \
  -config <( \
    echo '[req]'; \
    echo 'distinguished_name=req'; \
    echo '[san]'; \
    echo 'subjectAltName=DNS.1:www.company.dappy';)

# Publish www.company.dappy certificate on dappy
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
          "data": "$(openssl base64 -A -in company.pem)"
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

# Push www.company.dappy on dappy
dappy-cli pushzones

# Confirm that www.company.dappy CERT is published on dappy
dappy-lookup www.company.dappy CERT --endpoint=http://127.0.0.1:3001 --cacert=dappynode.crt --hostname=localhost
```

## Enable TLS and run www.company.dappy using nginx

```sh
# Run nginx in a container
docker run --rm --name company \
    -v $(pwd)/nginx/nginx-tls.conf:/etc/nginx/nginx.conf \
    -v $(pwd)/company-key.pem:/etc/nginx/company-key.pem \
    -v $(pwd)/company.pem:/etc/nginx/company.pem \
    -p 80:80 \
    -p 443:443 \
    nginx \
    nginx-debug -g 'daemon off;'
```

## Visit https://www.company.dappy with curl
```sh
# Concatenate dappy-node and www.company.dappy certificates for curl
cat dappynode.crt > certs.pem && echo "\n" >> certs.pem && cat company.pem >> certs.pem

# Visit https://www.company.dappy using curl and resolving name with dappy-node DOH server
curl --cacert certs.pem --doh-url https://localhost:3002/dns-query https://www.company.dappy
```

## Visit https://www.company.dappy with chrome 

```sh
# OSX only, trust dappy-node certificate 
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain company.pem
# Using chrome, visit https://www.company.dappy
# Should display Success !!!

# Chrome resolved wwww.company.dappy using dappy DOH server and Dappy name system and
```

# DEMO 3: Authenticate clients using custom CA

## Create client certificate and sign it with custom CA

## Verify client certicate using dappy on nginx