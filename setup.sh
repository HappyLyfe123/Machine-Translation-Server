if [ "$EUID" -ne 0 ]
  then echo "Requires sudo"
  exit
fi
# Setup script
# Update OS
apt update
apt upgrade

# Install node
echo "Installing Node JS"
apt install -y nodejs
apt install -y npm

# Install Mongo
echo "Installing Mongo"
apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv 9DA31620334BD75D9DCB49F368818C72E52529D4
echo "deb [ arch=amd64 ] https://repo.mongodb.org/apt/ubuntu bionic/mongodb-org/4.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-4.0.list
apt update
sudo apt-get install -y mongodb-org
service mongod start

# Create Configuration Files
mkdir config
# Create Google Service account files
touch config/google_api_key.json
cat <<EOT >> config/google_api_key.json
{
  "type": "service_account",
  "project_id": "united-sunbeam-223701",
  "private_key_id": "1bcb3642efa118bce16397576e6800b09bf544b9",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQC0G9cX1XYr15CL\nv6iK6y+xjI3Rs1JUAV4S0B3EDVO6/S3tzD7Ra4vUfkPxlyLDi4gNg0AX62xr9WfK\nMuoQT0jaXsLQ+SQmq/9dW2w9hI8rkqix0xBB/LNhaZG8VxB/brJGCJwetzTziWFG\n$
  "client_email": "652540730612-compute@developer.gserviceaccount.com",
  "client_id": "117543293570210861450",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/652540730612-compute%40developer.gserviceaccount.com"
}
EOT
# Create API Keys file
touch config/api.json
cat <<EOT >> config/api.json
{
"wordsKey": "HPoAkP6X1omshvlPPxb3XBWDBuhip1PEOnTjsnHDUDv1PfXlu2",
"googleProjectId": "united-sunbeam-223701",
"azureKey" : "c5e7b90c634f425aa26475a95925e349",
"yandexKey" : "trnsl.1.1.20181121T224602Z.2ee92b6c3b07680a.a62f7aac435d8b52c2d0a27c180ef964bbb97fae"
}
EOT
# Create Mongo Config file
touch config/mongo.json
cat <<EOT >> config/mongo.json
{
"url": "mongodb://localhost:27017/MeetKai"
}
EOT
# Create Server Configuration file
touch config/server.json
cat <<EOT >> config/server.json
{
"hstsTimeLimit": 31536000,
"cipherKey": "ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-CBC-SHA384:ECDHE-RSA-AES256-CBC-SHA256:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384:!aNULL:!MD5:!DSS", 
"privKeyPath": "/etc/letsencrypt/live/penguindan-test.gq//privkey.pem",
"fullchainPath": "/etc/letsencrypt/live/penguindan-test.gq//fullchain.pem",
"httpPort": 80,
"httpsPort": 443,
"clientId": "6e743a22-4943-48c1-bb51-4258761ef67a",
"adminSecret": "apple",
"monitorPort" : 30000
}
EOT

# Create System Variable for Google Translate API
echo "export GOOGLE_APPLICATION_CREDENTIALS='./config/google_api_key.json'" >> ../.profile
export GOOGLE_APPLICATION_CREDENTIALS='./config/google_api_key.json'

# Install Server Files
npm install
