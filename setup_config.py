# Import script modules
import os
import json
import uuid

# Print to the user what is happening
print('Setting up server configuration files')
print('=' * 60)

# Check whether the configuration directory exists
# if not, create it
if not os.path.exists('./config'):
    os.makedirs('config')

# Write into the server configuration file
with open('./config/server.json', 'w') as server_file:
    # Setup HTTP and HTTPS ports
    http_port = int(input('Http Port: '))
    https_port = int(input('Https Port: '))
    monitor_port = int(input('Monitoring UDP Port: '))

    # Generate client secret and client id
    client_id = str(uuid.uuid4())
    print('Client ID: %s' %client_id)
    admin_secret = str(uuid.uuid4())
    print('Admin Secret: %s' %admin_secret)

    # Ask the user for the configuration information
    hsts_time_limit = int(input('Time limit for HTTP Strict Transport Security(days): '))
    # Time limit must be in seconds
    # hsts_time_limit = <DAYS> * Seconds_in_Minute * Minute_in_Hour * Hour_in_Day
    hsts_time_limit = hsts_time_limit * 60 * 60 * 24

    while(True):
        # Ask the user for their certificate locations for SSL
        cert_dir = input('SSL Certificate Directory Location: ')
        # Check whether the directory exists
        if os.path.isdir(cert_dir):
            # Check for the private and fullchain keys
            privkey_path = cert_dir + '/privkey.pem'
            fullchain_path = cert_dir + '/fullchain.pem'
            if (not os.path.exists(privkey_path) or not os.path.exists(fullchain_path)):
                print('Private and Fullchain Key does not exist in the specified directory.')
            else:
                break
        else:
            print("Directory does not exist.\nPlease enter a valid directory.")

    
    # Setup default server cipher keys for the highest level of secure communication
    # between client and server
    cipher_key = ':'.join(['ECDHE-ECDSA-AES256-GCM-SHA384',
                            'ECDHE-RSA-AES256-GCM-SHA384',
                            'ECDHE-RSA-AES256-CBC-SHA384',
                            'ECDHE-RSA-AES256-CBC-SHA256',
                            'ECDHE-ECDSA-AES128-GCM-SHA256',
                            'ECDHE-RSA-AES128-GCM-SHA256',
                            'DHE-RSA-AES128-GCM-SHA256',
                            'DHE-RSA-AES256-GCM-SHA384',
                            '!aNULL',
                            '!MD5',
                            '!DSS'])
    
    # Write to the server configuration file
    server_file.write(json.dumps({
        'hstsTimeLimit' : hsts_time_limit,
        'cipherKey' : cipher_key,
        'privKeyPath' : privkey_path,
        'fullchainPath' : fullchain_path,
        'httpPort' : http_port,
        'httpsPort' : https_port,
        'monitorPort' : monitor_port,
        'clientId' : client_id,
        'adminSecret' : admin_secret
    }))

# Write into the API Keys Configuration file
with open('./config/api.json', 'w') as api_file:
    # The API key for the WordsAPI
    words_api_key = input('Words API Key : ')

    # Setup the Google Project ID
    google_project_id = input('Google Project ID: ')

    # Setup the Azure Key
    azure_key = input('Azure Key: ')

    # Setup Yandex Key
    yandex_key = input('Yandex Key: ')

    # Write to the API Key configuration file
    api_file.write(json.dumps({
        'wordsKey' : words_api_key,
        'googleProjectId' : google_project_id,
        'azureKey' : azure_key,
        'yandexKey' : yandex_key
    }))

# Write into the mongo configuration file
with open('./config/mongo.json', 'w') as db_file:
    # The port in which to run the mongo database
    mongo_port = int(input('Mongo Port: '))

    # Write to the mongo configuration file
    db_file.write(json.dumps({
        'url' : 'mongodb://localhost:%d/MeetKai' %(mongo_port)
    }))
