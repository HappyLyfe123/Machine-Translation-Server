# MeetKai-Server
MeetKai-Server is my attempt at creating a secure Node.js Server for Machine Translation Annotation with strict
User and Application Authentication/Authorization restrictions.

## Table of Contents
1. [Time Allocation](#time%201%20allocation)
2. [Installation](#installation)
    * [Testing](#testing)
3. [Architecture](#architecture)
   * [Backend Server Framework of Choice](#Backend%201%20Server%201%20Framework%201%20Of%201%20Choice)
   * [Security First Design](#Security%201%20First%201%20Design)
   * [Schemas](#schemas)
4. [Accomplishment Checklist](#Accomplishment%201%20Checklist)

## Time Allocation
32 Hours Server and Client Design and Code implementation<br>
3 Hours Server and Client End-to-End Testing<br>
4 Hours Documentation<br>

## Installation
REQUIREMENTS:
* The server must have an external IP Address and a domain name pointing to the IP address
* Simply Login and run the setup script from the google cloud compute engine <br>
* The server is EMPTY, meaning it has been freshly initialized, and nothing added.
   * I set up EXTERNAL variables such as allowing the instance to run with the Google translator API, the External IP Address to be mapped to the proper domain name. However, I have not written a single line of code in the instance. The setup script should run properly on the empty server.
* Why?
   * Remove any potential external variables and the necessity of implementing SSL for security reasons as explained in the following sections. I found this way to be the easiest and fastest way for installing and running setup.
   * External Variables Include:
        * Firewall blocking a port.
        * Setting up Google API Keys to work with an instance of a server
        * Invalid DNS setup for SSL certificates
        * Missing OS Files such as Python3, ufw, etc
        * Clashing npm versions or other OS files
  * I was unable to implement Docker due to time restrictions, I concluded this would be the best course of action to take to eliminate any possible runtime errors.
  
### Steps:
1. Login to the following google account:
   * username : meet.k.testing.daniel@gmail.com
   * password : danielktesting1
2. Go to the following link:
   * https://console.cloud.google.com/compute/instances?project=united-sunbeam-223701
   * Make sure that you are logged in as meet.k.testing.daniel@gmail.com
3. Click on SSH, the server should already be running
4. type sudo apt update
5. type sudo apt upgrade, Yes when prompted
6. type sudo apt install -y git
7. type git clone https://github.com/PenguinDan/MeetKai-Server.git
8. type cd MeetKai-Server
9. type sudo ./setup.sh
   * If prompted about Location, Type 2 for America
   * If prompted about timezone, type 85 for Los Angeles
   * Use email meet.k.testing.daniel@gmail.com
   * Type "A" to agree to terms
   * Type "Yes" to agree
   * Type Yes to potentially messing up the connection
10. sudo npm start
11. The server is setup, you can connect to it using the Postman json files as specified in the Testing Section or use the Android application

### Testing
Extensive E2E Testing Using Postman
* Contains text files for Input and Server Output Examples
* [Postman Files](https://github.com/PenguinDan/MeetKai-Server/tree/master/postman)
* Import the file into Postman
* There is a saved example (top right corner) and you can load them for each request
* The server monitoring can only be tested on Android

Android Client Side - Visual Client Side Testing
* [Android Meet-Kai Client](https://github.com/PenguinDan/MeetKai-Test-Client)

!!!IMPORTANT!!! <br>
* Admin/Application Secret is "apple" to create an admin account <br>
* The android appliction ensures proper request format. I did my best to find and fix every possible bug and edge case. The Android Application allows less user flexibility, requiring stricter requests than postman.

## Architecture
### Backend Server Framework of Choice
Node.js
* Why?
  * Constants and wide community support of modules
  * Amongst the state of the art for server backend development
  * Fast development with many Security API's to be used
* Why Javascript?
  * Ability to write asynchronous code easily through the use of Promises
  * Wide community support and one of the languages I am most familiar with.
  
### Security First Design
TCP Communication through SSL
* All requests being sent to and from the server first establish an SSL handshake with the current state of the art 
Cipher Suites. If the client is unable to satisfy the minimum requirements to establish a secure encrypted connection, the connection is broken.
* All unsecure HTTP requests are forwarded to an HTTPS Connection.
* Implementation of HSTS enforces users to communicate strictly through HTTPS only.

Follow strict OAuth2.0 and AWS Incognito Standards using *Refresh/Access Tokens* and Application Client ID and Secrets
* When the user logs in, they are given a randomly generated Refresh and Access Token which are transported through an
SSL Tunnel to the user's application.
* Refresh and Access Tokens each contain an expiration timer. Access Tokens have a lifespan of exactly 15 minutes (a value that can be easily shortened) because they are the primary form of user access *authorization*. If a man in the middle attack is able to retrieve the access token, they only have a short amount of time in order to use the token for their attack. A refresh token is only retrievable once, when the user logs in and has a life span of 4 hours. This token should be kept safe in a user's application and is used periodically to retrieve new user access tokens. 
* If the user wants to access any of their information or the server's resources, they must send both their Username and Access Tokens to the server which are verified to see if they are valid and un-expired. Each user has their own access tokens, therefore, a user is unable to access another user's information with an exception of an Admin account.
* An application ClientID must follow every request to authenticate the application sending the request.
* An administrator is able to use the Application Secret (which is only known ONCE during server creation by an admin) to establish admin accounts that are opened to more routes such as monitoring and source annotation retrieval methods.

User Login and Account Creation
* A user's login and account creation information is always kept secure through an SSL connection.
* A user's password is kept Hashed using BCRYPT to prevent rainbow table attacks.

### Schemas
Source Schema
* Phrase : Contains the source text's phrase
* Hash : The source phrase hash hexadecimal hash for easier queries
* Annotation Count : The source text index, allows for easy retrieval of source texts that have been annotated the least
* Annotations : A Map object mapped the following manner
```
annotations: {
  LANGUAGE:
      Azure:
          Translation:
          correct:
          incorrect:
     Google:
          Translation:
          correct:
          incorrect:
     Yandex:
          Translation:
          correct:
          incorrect:
  LANGUAGE: ...
}
```
* The example schema for source
```
const SourceSchema = new mongoose.Schema({
    phrase: {
        type: String,
        required : true
    },
    hash : {
        type : String,
        unique : true
    },
    annotationCount : {
        type: Number,
        required : true,
        index : true
    },
    annotations : Map
});
```
User Schema
* username : The user's username
* password : The User's hashed password
* accessToken : The user's access token
* refreshToken : The user's refresh token
* isAdmin : Whether the user is an admin
* annotations : A map of map that stores the user's annotation attempts
```
const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        unique : true,
        required: true
    },
    password: {
        type: String,
        required: true
    },
    accessToken :{
        token: String,
        expiration: Date
    },
    refreshToken : {
        token: String,
        expiration : Date
    },
    isAdmin : {
        type : Boolean,
        required : true
    },
    annotations : {
        type : Map,
        of: Map
    }
});
```

## Accomplishment Checklist

### Database with Source Text and Translation Attempts
Mongo Database
* Why?
  * With the short time limit that I had to build the application, I chose to use Mongo because of its simple Collection
  and Document Database design. I was able to design the schemas for both the User and Source Collections in under an hour.
  * The ability to work with the Mongoose API greatly enhanced the speed and efficiency of designing middleware methods

### Database must randomly generate Source Text with a source API (BONUS)
Words API - https://www.wordsapi.com/
* What is it?
  * Words API is an API for the English Language where a developer can retrieve various items related to the English language
 including definitions, examples, etc.
* Why?
  * Again, time was a vast concern for building a project. The more time I had to take to design algorithms, the less time 
 I would have for testing, leading to a buggy server/client project.
  * Efficiency was a crucial reason why I chose the Words API. Many other API's incorporated source texts that contained too much meta-data or otherwise source texts that had to be scanned for a random word. I was also scared for the chance of vulgar or otherwise innapropriate or empty source texts being incorporated into the database from the Twitter or Reddit API. The Words API always returned a VALID text.
  * Also contains an easy to use random query request
* How did I use it?
  * 25% of the time, a random word definition was retrieved from the database
  * 25% of the time, a random word example (such as the word in a sentence) was retrieved from the database
  * The other 50% of the time, a query was made to the database to retrieve a source text with a low amount of annotations to 
  be annotated once again by a user.
  
### Multiple Third Party Translation Attempts (BONUS)
Microsoft Azure, Google, and Yandex
* How did I use it?
  * When a random source text is retrieved, 3 requests are sent to be translated into a user defined language.
  
### API to add New Source Objects
* How?
  * Security was a big concern when creating the server. The user must send a valid access token to add any source texts to the database

### API For Login and Account Registration
* How?
  * User account creation and login requests are all sent through an SSL tunnel for secure encrypted communication.
  * Please refer the "Security First Design" section in the architecture section.

### API for Annotation Attempts
* How?
  * The user is able to retrieve an original phrase and annotation in the language of their choice. They will receive 4 items: the original phrase in English, the google translation, the azure translation, and yandex translation. The user is then able to mark each of the translations as correct or incorrect through the android user interface.
  
### API for Retrieving all annotations for a Source
* How?
  * This requires the use of an admin account.
  * The admin receives a list of hashes (or phrases) and is able to easily select the annotations for the source text in all of the attempted languages.

### Privilege System
* How?
  * Through the use of user access tokens, refresh tokens, admin secrets, and client ids.
  * Please refer the "Security First Design" section in the architecture section

### Provide an Admin Application that Contains Real Time results Pushed from the Backend to it (BONUS)
* How?
  * First, an IPC (Interprocess Communication) and UDP Server is created through a Fork Method which allows another process to be running concurrently in the server.
  * If an admin user wants to monitor the server, they send an HTTPS request to the server. If the admin contains the correct credentials, their application IP address will be allowed for monitoring services. 
  * The middleware authorization method sends an IPC message to the Node IPC Server to add an ip-address to the list of acceptable addresses.
  * Once the user receives a verification that they are allowed to receive monitoring services, they are now able to retrieve UDP packets pushed from the server.
  * When a user annotates an item, an IPC message is sent to the IPC Server. The IPC server notifies all of the listening "monitors" of the annotation through a UDP Packet.
  
 ### Deploy your application to a Cloud (BONUS)
 * The application was deployed to a Google Compute Engine
 * The installation process uses a live google cloud engine and will be able to retrieve requests sent to https://www.penguindan-test.gq
