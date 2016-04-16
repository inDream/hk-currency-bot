'use strict';

const cheerio = require('cheerio');
const rp = require('request-promise');

const request = rp.defaults({
  headers: {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus  Build/MRA58N) ' +
      'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/46.0.2490.76 ' +
      'Mobile Safari/537.36'
  }
});

class Fetcher {
  constructor() {}

  fetchBankNames() {
    let url = 'http://hk.ttrate.com/m/zh_hk/index.php';
    return request(url)
      .then((resp) => {
        let $ = cheerio.load(resp);
        let names = $('select[name="b"] option');
        let result = [];
        names.each((i, e) => {
          let val = $(e).attr('value');
          let name = $(e).text();
          if (val > 0) {
            result.push({id: +val, name: name});
          }
        });
        return result;
      });
  }
}

module.exports = Fetcher;
