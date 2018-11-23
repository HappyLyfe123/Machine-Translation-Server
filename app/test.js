const request = require('request-promise');

let options = {
  method: 'POST',
  baseUrl : 'https://translate.yandex.net/',
  url: 'api/v1.5/tr.json/translate',
  qs: {
    'key' : 'trnsl.1.1.20181121T224602Z.2ee92b6c3b07680a.a62f7aac435d8b52c2d0a27c180ef964bbb97fae',
    'text' : 'hello',
    'lang' : 'en-ru'
  },
  json : true
}

request(options).then((result) => {
  console.log(result.text[0]);
});