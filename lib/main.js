'use strict';

const config = require('../config');
const CronJob = require('cron').CronJob;
const Fetcher = require('./fetcher');
const moment = require("moment");
const Promise = require("bluebird");

class Main {
  constructor(ds) {
    let self = this;
    this.banks = {};
    this.banksId = {};
    this.banksIdMsg = '';
    this.prices = {};
    this.bestPrices = {};
    this.needReloadPrice = false;
    
    this.ds = ds;
    this.fetcher = new Fetcher(self);
    
    this.insertBankNames();
    this.initBankNames();
    this.initLastPrices();

    // Fetch currecy price every 10 minutes during trading
    new CronJob('0 */10 8-23 * * *', function() {
      self.fetchAllCurrency();
    }, null, true);
    // Fetch currecy price every 30 minutes after trading
    new CronJob('0 */30 0-7 * * *', function() {
      self.fetchAllCurrency();
    }, null, true);
  }

  initBankNames() {
    let self = this;
    self.ds.bank.findAndCountAll()
      .then((res) => {
        if (res.count > 0) {
          self.initBankMap(res.rows);
          console.log('Loaded', res.rows.length, 'banks.');
        } else {
          return self.insertBankNames();
        }
      });
  }

  insertBankNames() {
    let self = this;
    return this.fetcher.fetchBankNames()
      .then((names) => {
        if (names.length) {
          return Promise.all(names.map( (name) => {
            return self.ds.bank.upsert(name);
          }));
        }
      })
      .then((banks) => {
        if (banks.length) {
          self.initBankNames();
          console.log('Inserted', banks.length, 'banks.');
        } else {
          console.warn('Cannot fetch bank names.');
        }
      });
  }

  initBankMap(banks) {
    let self = this;
    banks.forEach(bank => {
      self.banks[bank.id] = bank.name;
      self.banksId[bank.name] = bank.id;
    });

    let msg = 'Available bank id: \n';
    let ids = Object.keys(self.banks);
    ids.forEach(id => {
      msg += id + ': ' + self.banks[id] + ', ';
    });
    msg = msg.slice(0, -2);
    self.banksIdMsg = msg;
  }

  initLastPrices() {
    let self = this;
    self.bestPrices = {};
    config.availCurrencies.forEach(c => {
      self.prices[c] = [];
      self.bestPrices[c] = {stt: -999, snt: -999, btt: 999, bnt: 999};
    })
    let sql = 'SELECT DISTINCT ON (code, bank) ' +
      'code, bank, stt, snt, btt, bnt, ts ' +
      'FROM histories ORDER BY code, bank, ts DESC';
    return self.ds.sequelize.query(sql, {
      type: self.ds.sequelize.QueryTypes.SELECT,
      raw: true
    })
    .then((prices) => {
      let count = 0;
      let now = moment();
      let closeT = moment().day(0).day(7).hours(11).minutes(30);
      let base = moment().diff(closeT, 'h');
      prices.forEach(price => {
        let diff = moment(price.ts).diff(closeT, 'h');
        let diffnow = moment(price.ts).diff(now, 'h');
        if ((base < -48 || (base > -48 && diff > 0)) && diffnow > -36) {
          self.initBestPrices(price);
        }
      });
      let recentPrices = JSON.parse(JSON.stringify(self.bestPrices));
      prices.forEach(price => {
        self.prices[price.code][price.bank] = price;
        self.initBestPrices(price);
        delete price.code;
        delete price.bank;
        count++;
      });
      for (let code in recentPrices) {
        let prices = recentPrices[code];
        ['stt', 'snt', 'btt', 'bnt'].forEach(f => {
          if (Math.abs(prices[f]) !== 999) {
            self.bestPrices[code][f] = prices[f];
            self.bestPrices[code][f + 'b'] = prices[f + 'b'];
          }
        });
      }
      console.log('Loaded', count, 'records.');
    });
  }

  initBestPrices(price) {
    let self = this;
    let code = this.bestPrices[price.code];
    ['stt', 'snt'].forEach((f) => {
      if (price[f] && price[f] > code[f]) {
        code[f] = price[f];
        code[f + 'b'] = +price.bank;
      }
    });
    ['btt', 'bnt'].forEach(f => {
      if (price[f] && price[f] < code[f]) {
        code[f] = price[f];
        code[f + 'b'] = +price.bank;
      }
    });
  }

  fetchAllCurrency() {
    let self = this;
    self.needReloadPrice = false;
    return Promise.map(config.availCurrencies, (code) => {
      return self.insertCurrency(code).delay(1000);
    }, {concurrency: 1})
    .then(function() {
      console.log('Finished fetch all currencies');
      if (self.needReloadPrice) {
        self.initLastPrices();
      }
    });
  }

  insertCurrency(code) {
    let self = this;
    return self.fetcher.fetchCurrency(code)
      .then((prices) => {
        if (!prices.length) {
          return false;
        }
        let count = 0;
        prices.forEach(price => {
          let bank = self.prices[price.code][price.bank];
          if (!bank || (bank.stt !== price.stt || bank.btt !== price.btt ||
            bank.snt !== price.snt || bank.bnt !== price.bnt)) {
            self.ds.history.create(price);
            count++;
          }
        });
        if (count > 0) {
          self.needReloadPrice = true;
          console.log('Inserted', count, code, 'records.');
        }
      });
  }

  inlineAnswer(args) {
    let self = this;
    args = args.toUpperCase().split(' ');
    let code = args[0];
    let bank = self._parseIntArg(args[1]);
    console.log('inlineAnswer', code, bank);
    if (config.availCurrencies.indexOf(code) > 0) {
      let a1 = self._listCurrency_sub(code, bank);
      let t1 = a1.split('\n')[0];
      let a2 = self._listCurrency_sub(code, bank, 1);
      let t2 = a2.split('\n')[0];
      return  [{title: t1, message_text: a1}, {title: t2, message_text: a2}];
    }
  }

  _parseIntArg(arg) {
    return isNaN(parseInt(arg)) ? false : +arg;
  }

  listCurrency(args) {
    let self = this;
    args = args.toUpperCase().split(' ');
    let code = args[0];
    let bank = self._parseIntArg(args[1]);
    let reverse = self._parseIntArg(args[2]);
    console.log('listCurrency', code, bank, reverse);
    if (config.availCurrencies.indexOf(code) > 0) {
      return self._listCurrency_sub(code, bank, reverse);
    } else if (code === 'ALL') {
      let res = '';
      config.availCurrencies.forEach(code => {
        res += self._listCurrency_sub(code, bank, reverse);
      });
      return res;
    }
  }

  _listCurrency_sub(code, bank, reverse) {
    let self = this;
    let fields = ['stt', 'snt', 'btt', 'bnt'];
    let names = ['電匯銀行買入', '現鈔銀行買入', '電匯銀行賣出', '現鈔銀行賣出'];
    let price = self.bestPrices[code];
    if (bank) {
      price = self.prices[code][bank];
      if (!price) {
        return '';
      }
    }
    let res =  (reverse ? 'HKD/' + code : code + '/HKD') + '\n';
    let i = 0;
    fields.forEach(f => {
      let pbank = bank || price[f + 'b'];
      if (pbank && price[f]) {
        let val = reverse ? (1 / price[f]).toFixed(6) : price[f];
        res += names[i] + ': ' + val + ' ' + self.banks[pbank] + '\n';
      }
      i++;
    });
    return res;
  }
}

module.exports = Main;
