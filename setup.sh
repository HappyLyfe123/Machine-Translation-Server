if [ "$EUID" -ne 0 ]
  then echo "Requires sudo"
  exit
fi
# Setup script
# Update OS
apt update
apt upgrade

# Install certbot and setup SSL Certificates
apt install software-properties-common
add-apt-repository ppa:certbot/certbot
apt update
apt install -y certbot
certbot certonly --standalone -d !!!SITENAME!!! -d !!!WWW.SITENAME.COM!!!


# Setup Firewall
apt install -y ufw
ufw allow ssh
ufw allow http
ufw allow https
ufw allow 30000:60000/udp
ufw enable

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
!!!GOOGLE SECRET!!!
EOT
# Create API Keys file
touch config/api.json
cat <<EOT >> config/api.json
{
"wordsKey": !!! WORDS API KEY !!!,
"googleProjectId": !!!GOOGLE PROJECT ID !!!,
"azureKey" : !!! AZURE KEY !!!
"yandexKey" : !!! YANDEX KEY !!!
}
EOT
# Create Mongo Config file
touch config/mongo.json
cat <<EOT >> config/mongo.json
{
"url": !!! MONGO URL !!!
}
EOT
# Create Server Configuration file
touch config/server.json
cat <<EOT >> config/server.json
{
"hstsTimeLimit": 31536000,
"cipherKey": "ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-CBC-SHA384:ECDHE-RSA-AES256-CBC-SHA256:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384:!aNULL:!MD5:!DSS", 
"privKeyPath": !!! PRIV KEY LOC !!!,
"fullchainPath": !!! FULL CHAIN LOC !!!
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
