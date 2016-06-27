'use strict';

const config = require('./config');
const DB = require('./models');
const Notifier = require('./lib/notifier');
const Main = require('./lib/main');
const Stat = require('./lib/stat');

const db = new DB(config.pg);
const TeaBot = require('teabot')(config.token.telegram, config.botname);
const botan = require('teabot-botan');
const express = require('express');
const bodyParser = require('body-parser');

db.init()
  .then(function(ds) {
    let main = new Main(ds);
    let notifier = new Notifier(main, ds);
    let stat = new Stat(main, ds);
    initApp(main, notifier, stat);
  });

function initApp(main, notifier, stat) {
  const app = express();
  app.use(bodyParser.json());
  TeaBot.use('analytics', botan(config.token.botan, {allowQuery: true}));
  TeaBot.setWebhook(config.webhook.url);

  TeaBot.onError(function (e) {
    console.error('TeaBot error:', e.stack);
  });

  /**
  help - Show commands description
  bank - Show available banks
  currency - Show available currencies
  list - List currencies price
  track - Track currency price
  untrack - Untrack currency
  interval - Set notify time interval
  **/

  TeaBot
    .defineCommand('/start', function (dialog) {
      dialog.sendMessage('Hello, This is Hong Kong Currency Bot.');
    })
    .defineCommand('/bank', function (dialog) {
      dialog.sendMessage(main.banksIdMsg);
    })
    .defineCommand('/currency', function (dialog) {
      dialog.sendMessage('Available currencies code: ' + 
        config.availCurrencies.join(' '));
    })
    .defineCommand('/help', function (dialog) {
      dialog.sendMessage('/list [currency code / "all"] [bank id / "best"] ' +
        '[1 = 1/code (reverse)]\n e.g. /list all 1 1 \n'+
        '(Default list best price among all banks) \n' +
        '/track or /untrack [currency code]\n' +
        '/interval [15 / 60 / 240 / 1440] (minutes)');
    })
    .defineCommand('/rate', function (dialog, message) {
      dialog.sendMessage('Select bank', main.inlineBanks());
    })
    .defineCommand('/list', function (dialog, message) {
      let args = message.getArgument();
      if (args) {
        let ans = main.listCurrency(args);
        if (ans) {
          dialog.sendMessage(ans);
          stat.inc(args);
        }
      } else {
        stat.dialogRecent(dialog);
      }
    })
    .defineCommand('/track', function (dialog, message) {
      let args = message.getArgument();
      if (args) {
        dialog.sendMessage(notifier.track(args));
      }
    })
    .defineCommand('/untrack', function (dialog, message) {
      let args = message.getArgument();
      if (args) {
        dialog.sendMessage(notifier.untrack(args));
      }
    })
    .defineCommand('/interval', function (dialog) {
      let args = message.getArgument();
      if (args) {
        dialog.sendMessage(notifier.interval(args));
      }
    });

  TeaBot
    .inlineQuery(function(query) {
      let qtext = query.query.query;
      let qdata = query.query.data;
      if (qdata) {
        if (qdata.indexOf('Bank') === 0) {
          let bank = parseInt(qdata.slice(4));
          query.editMessageReplyMarkup(main.inlineOthers(0, bank));
        } else if (qdata.indexOf('Others') === 0) {
          let reverse = parseInt(qdata.slice(0, -1));
          query.editMessageReplyMarkup(main.inlineOthers(reverse, 0));
        } else {
          let ans = main.inlineAnswer(qdata, true).message_text;
          query.editMessageText(ans);
          stat.inc(qdata);
        }
      } else if (qtext) {
        let ans = main.inlineAnswer(qtext);
        if (ans && ans.length) {
          query.addArticles(ans).answer();
          stat.inc(qtext);
        } else {
          stat.inlineRecent(query);
        }
      } else {
        stat.inlineRecent(query);
      }
    })
    .inlineQueryChosen(data => {
      stat.inc(data.chosen_inline_result.result_id);
    });

  app.post(config.webhook.path, function (req, res) {
    var message = req.body || false;
    if (message) {
      TeaBot.receive(message);
    }

    res.status(200).end();
  });

  app.listen(config.webhook.port);
}
