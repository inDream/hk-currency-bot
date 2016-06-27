'use strict';

const config = require('../config');
const CronJob = require('cron').CronJob;
const Fetcher = require('./fetcher');
const moment = require("moment");
const Promise = require("bluebird");

class Main {
  constructor(ds) {
    this.banks = {};
    this.banksId = {};
    this.banksIdMsg = '';
    this.prices = {};
    this.pricesRev = {};
    this.bestPrices = {};
    this.bestPricesRev = {};
    this.needReloadPrice = false;
    
    this.ds = ds;
    this.fetcher = new Fetcher(this);
    
    this.insertBankNames();
    this.initBankNames();
    this.initLastPrices();

    // Fetch currecy price every 10 minutes during trading
    new CronJob('0 */10 8-23 * * *', () => {
      this.fetchAllCurrency();
    }, null, true);
    // Fetch currecy price every 30 minutes after trading
    new CronJob('0 */30 0-7 * * *', () => {
      this.fetchAllCurrency();
    }, null, true);
  }

  initBankNames() {
    this.ds.bank.findAndCountAll()
      .then(res => {
        if (res.count > 0) {
          this.initBankMap(res.rows);
          console.log('Loaded', res.rows.length, 'banks.');
        } else {
          return this.insertBankNames();
        }
      });
  }

  insertBankNames() {
    return this.fetcher.fetchBankNames()
      .then(names => {
        if (names.length) {
          return Promise.all(names.map(name => {
            return this.ds.bank.upsert(name);
          }));
        }
      })
      .then(banks => {
        if (banks.length) {
          this.initBankNames();
          console.log('Inserted', banks.length, 'banks.');
        } else {
          console.warn('Cannot fetch bank names.');
        }
      });
  }

  initBankMap(banks) {
    banks.forEach(bank => {
      this.banks[bank.id] = bank.name;
      this.banksId[bank.name] = bank.id;
    });

    let msg = 'Available bank id: \n';
    let ids = Object.keys(this.banks);
    ids.forEach(id => {
      msg += id + ': ' + this.banks[id] + ', ';
    });
    msg = msg.slice(0, -2);
    this.banksIdMsg = msg;
  }

  initLastPrices() {
    let sql = 'SELECT DISTINCT ON (code, bank) ' +
      'code, bank, stt, snt, btt, bnt, ts ' +
      'FROM histories ORDER BY code, bank, ts DESC';
    return this.ds.sequelize.query(sql, {
      type: this.ds.sequelize.QueryTypes.SELECT,
      raw: true
    })
    .then(prices => {
      this.initBestPrices(prices, false);
      this.initBestPrices(prices, true);
    });
  }

  initBestPrices(prices, reverse) {
    let bpKey = 'bestPrices' + (reverse ? 'Rev' : '');
    let pKey = 'prices' + (reverse ? 'Rev' : '');
    this[bpKey] = {};
    this[pKey] = {};
    config.availCurrencies.forEach(c => {
      this[pKey][c] = [];
      this[bpKey][c] = reverse ? {stt: 999, snt: 999, btt: -999, bnt: -999} :
        {stt: -999, snt: -999, btt: 999, bnt: 999};
    });

    let count = 0;
    let now = moment();
    let closeT = moment().day(0).day(7).hours(11).minutes(30);
    let base = moment().diff(closeT, 'h');
    prices.forEach(price => {
      let diff = moment(price.ts).diff(closeT, 'h');
      let diffnow = moment(price.ts).diff(now, 'h');
      if ((base < -48 || (base > -48 && diff > 0)) && diffnow > -12) {
        this._initBestPrices(price, reverse);
      }
    });
    let recentPrices = Object.assign({}, this[bpKey]);
    prices.forEach(price => {
      let p = Object.assign({}, price);
      delete p.code;
      delete p.bank;
      this[pKey][price.code][price.bank] = p;
      this._initBestPrices(price, reverse);
      count++;
    });
    for (let code in recentPrices) {
      let prices = recentPrices[code];
      ['stt', 'snt', 'btt', 'bnt'].forEach(f => {
        if (Math.abs(prices[f]) !== 999) {
          this[bpKey][code][f] = prices[f];
          this[bpKey][code][f + 'b'] = prices[f + 'b'];
        }
      });
    }
    console.log(`Loaded ${count} records. (Rev: ${reverse})`);
  }

  _initBestPrices(price, reverse) {
    let code = this['bestPrices' + (reverse ? 'Rev' : '')][price.code];
    ['stt', 'snt'].forEach(f => {
      if (price[f] && (reverse ? price[f] < code[f] : price[f] > code[f])) {
        code[f] = price[f];
        code[f + 'b'] = +price.bank;
      }
    });
    ['btt', 'bnt'].forEach(f => {
      if (price[f] && (reverse ? price[f] > code[f] : price[f] < code[f])) {
        code[f] = price[f];
        code[f + 'b'] = +price.bank;
      }
    });
  }

  fetchAllCurrency() {
    this.needReloadPrice = false;
    return Promise.map(config.availCurrencies, (code) => {
      return this.insertCurrency(code).delay(1000);
    }, {concurrency: 1})
    .then(() => {
      console.log('Finished fetch all currencies');
      if (this.needReloadPrice) {
        this.initLastPrices();
      }
    });
  }

  insertCurrency(code) {
    return this.fetcher.fetchCurrency(code)
      .then(prices => {
        if (!prices.length) {
          return false;
        }
        let count = 0;
        prices.forEach(price => {
          let bank = this.prices[price.code][price.bank];
          if (!bank || (bank.stt !== price.stt || bank.btt !== price.btt ||
            bank.snt !== price.snt || bank.bnt !== price.bnt)) {
            this.ds.history.create(price);
            count++;
          }
        });
        if (count > 0) {
          this.needReloadPrice = true;
          console.log('Inserted', count, code, 'records.');
        }
      });
  }

  inlineAnswer(args, oneAns) {
    args = this.parseArg(args);
    if (!oneAns) {
      console.log('inlineAnswer', args.code, args.bank, args.reverse);
    }
    if (config.availCurrencies.indexOf(args.code) > 0) {
      let bank = args.bank ? ' ' + this.banks[args.bank] : '';
      let a1 = this._listCurrency_sub(args.code, args.bank);
      let t1 = a1.split('\n')[0] + bank;
      let a2 = this._listCurrency_sub(args.code, args.bank, 1);
      let t2 = a2.split('\n')[0] + bank;
      let ans = [
        {title: t1, message_text: a1, id: `${args.code} ${args.bank} 0`},
        {title: t2, message_text: a2, id: `${args.code} ${args.bank} 1`}
      ];
      return oneAns ? ans[args.reverse || 0] : ans;
    }
  }

  inlineOthers(reverse) {
    let keys = [];
    let temp = [];
    let i = 0;
    config.availCurrencies.forEach(c => {
      if (reverse) {
        let textRev = 'HKD/' + c.toUpperCase();
        temp.push({text: textRev, callback_data: c + ' 0 1'});
      } else {
        let text = c.toUpperCase() + '/HKD';
        temp.push({text: text, callback_data: c + ' 0 0'});
      }
      i++;
      if (i % 4 === 0) {
        keys.push(temp);
        temp = [];
      }
    });
    return {reply_markup: JSON.stringify({inline_keyboard: keys})};
  }

  _parseIntArg(arg) {
    return isNaN(parseInt(arg)) ? false : +arg;
  }

  parseArg(args) {
    args = args.toUpperCase().split(' ');
    let code = args[0];
    let bank = this._parseIntArg(args[1]);
    let reverse = this._parseIntArg(args[2]);
    return {code, bank, reverse};
  }

  listCurrency(args) {
    args = this.parseArg(args);
    console.log('listCurrency', args.code, args.bank, args.reverse);
    if (config.availCurrencies.indexOf(args.code) > 0) {
      return this._listCurrency_sub(args.code, args.bank, args.reverse);
    } else if (args.code === 'ALL') {
      let res = '';
      config.availCurrencies.forEach(code => {
        res += this._listCurrency_sub(args.code, args.bank, args.reverse);
      });
      return res;
    }
  }

  _listCurrency_sub(code, bank, reverse) {
    let fields = ['stt', 'snt', 'btt', 'bnt'];
    let names = ['電匯銀行買入', '現鈔銀行買入', '電匯銀行賣出', '現鈔銀行賣出'];
    let price = this['bestPrices' + (reverse ? 'Rev': '')][code];
    if (bank) {
      price = this['prices' + (reverse ? 'Rev': '')][code][bank];
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
        res += names[i] + ': ' + val + ' ' + this.banks[pbank] + '\n';
      }
      i++;
    });
    return res;
  }
}

module.exports = Main;
