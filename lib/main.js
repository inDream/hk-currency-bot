'use strict';

const config = require('../config');
const CronJob = require('cron').CronJob;
const Fetcher = require('./fetcher');
const Promise = require("bluebird");

class Main {
  constructor(ds) {
    let self = this;
    this.banks = {};
    this.banksId = {};
    this.prices = {};
    this.needReloadPrice = false;
    
    this.ds = ds;
    this.fetcher = new Fetcher(self);
    
    this.initBankNames();
    this.initLastPrices();

    // Fetch currecy price every 15 minutes
    new CronJob('0 */15 * * * *', function() {
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
          return self.ds.bank.bulkCreate(names);
        }
      })
      .then((banks) => {
        if (banks.length) {
          self.initBankMap(banks);
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
  }

  initLastPrices() {
    let self = this;
    config.availCurrencies.forEach(c => {
      self.prices[c] = [];
    })
    let sql = 'SELECT DISTINCT ON (code, bank) ' +
      'code, bank, stt, snt, btt, bnt ' +
      'FROM histories ORDER BY code, bank, ts DESC';
    return self.ds.sequelize.query(sql, {
      type: self.ds.sequelize.QueryTypes.SELECT,
      raw: true
    })
    .then((prices) => {
      let count = 0;
      prices.forEach(price => {
        self.prices[price.code][price.bank] = price;
        delete price.code;
        delete price.bank;
        count++;
      });
      console.log('Loaded', count, 'records.');
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
}

module.exports = Main;
