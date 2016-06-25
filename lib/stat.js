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

  getRecent() {
    let sql = `(SELECT * FROM stats ORDER BY count DESC LIMIT 3)
    UNION (SELECT * FROM stats ORDER BY "updatedAt" DESC LIMIT 2)
    ORDER BY "updatedAt" DESC`;
    let options = {type: this.ds.sequelize.QueryTypes.SELECT};
    return this.ds.sequelize.query(sql, options)
      .then(items => {
        let queries = items.map(item => {
          return `${item.code} ${item.bank} ${item.reverse ? 1 : 0}`;
        });
        return queries;
      });
  }

  dialogRecent(dialog) {
    console.log('dialogRecent');
    return this.getRecent()
      .then(items => {
        let keys = items.map(item => {
          let text = this.main.inlineAnswer(item, true).title;
          return [{text: text, callback_data: item}];
        });
        let options = {
          reply_markup: JSON.stringify({inline_keyboard: keys})
        };
        return dialog.sendMessage('Recent results', options);
      });
  }

  inlineRecent(query) {
    console.log('inlineRecent');
    return this.getRecent()
      .then(items => {
        let answers = items.map(item => {
          return this.main.inlineAnswer(item, true);
        });
        return query.addArticles(answers).answer();
      });
  }
}

module.exports = Stat;
