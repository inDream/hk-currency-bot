'use strict';

const Fetcher = require('./fetcher');

class Main {
  constructor(ds) {
    this.ds = ds;
    this.banks = {};
    this.fetcher = new Fetcher();
    this.initBankNames();
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
    });
  }
}

module.exports = Main;
