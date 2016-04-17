'use strict';

const cheerio = require('cheerio');
const moment = require('moment');
const py = require('python-shell');
const rp = require('request-promise');

const request = rp.defaults({
  headers: {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus  Build/MRA58N) ' +
      'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/46.0.2490.76 ' +
      'Mobile Safari/537.36'
  }
});

class Fetcher {
  constructor(main) {
    this.main = main;
  }

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

  fetchCurrency(code) {
    let self = this;
    let url = 'http://hk.ttrate.com/m/zh_hk/index.php?b=0&c=' + code;
    return request(url)
      .then((resp) => {
        let $ = cheerio.load(resp);
        if ($('#captcha_image').length) {
          console.log('Need to solve captcha.');
          return new Promise(function(resolve, reject) {
            py.run('./solver/auto.py', function (err, res) {
              if (err) {
                reject(err);
              } else {
                resolve();
              }
            });
          })
          .then(function() {
            return self.fetchCurrency(code);
          })
          .catch(function(err) {
            console.warn(err);
            return [];
          });
        } else {
          let banks = $('.rate_table tr');
          let time = $('.rc_footer').text().split('\n')[2].slice(4);
          time = moment(time, 'YYYY-MM-DD HH:mm:ss').toDate();
          let result = [];
          let columns = [null, 'stt', 'btt', 'snt', 'bnt'];
          banks.each((i, e) => {
            let prices = $(e).find('td');
            if (i > 0 && prices.length == 6) {
              let data = {code: code, ts: time};
              prices.each((i, e) => {
                let price = $(e).text();
                switch (i) {
                  case 0:
                    data.bank = self.main.banksId[$(e).text()];
                    break;
                  case 1:
                  case 2:
                  case 3:
                  case 4:
                    data[columns[i]] = price == '-' ? null : +price;
                }
              });
              result.push(data);
            }
          });
          return result;
        }
      });
  }
}

module.exports = Fetcher;