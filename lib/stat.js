'use strict';

class Stat {
  constructor(main, ds) {
    this.main = main;
    this.ds = ds;
  }

  inc(args) {
    args = this.main.parseArg(args);
    let query = {
      code: args.code,
      bank: args.bank ? args.bank + '' : '0',
      reverse: args.reverse === 1
    };
    return this.ds.stat.findOne({where: query})
      .then(item => {
        if (item) {
          return item.increment('count', {by: 1});
        } else {
          query.count = 1;
          return this.ds.stat.create(query);
        }
      });
  }
}

module.exports = Stat;
