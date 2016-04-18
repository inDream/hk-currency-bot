'use strict';

const config = require('./config');
const DB = require('./models');
const Notifier = require('./lib/notifier');
const Main = require('./lib/main');

const db = new DB(config.pg);
const TeaBot = require('teabot')(config.token.telegram, config.botname);
const express = require('express');
const bodyParser = require('body-parser');

db.init()
  .then(function(ds) {
    let main = new Main(ds);
    let notifier = new Notifier(main, ds);
    initApp(main, notifier);
  });

function initApp(main, notifier) {
  const app = express();
  app.use(bodyParser.json());
  TeaBot.use('analytics', require('teabot-botan')(config.token.botan));
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
      dialog.sendMessage('/list [currency code / "all"] [bank id]\n' + 
        '(Default list best price among all banks) \n' +
        '/track or /untrack [currency code]\n' +
        '/interval [15 / 60 / 240 / 1440] (minutes)');
    })
    .defineCommand('/list', function (dialog, message) {
      dialog.sendMessage(main.listCurrency(message.getArgument()));
    })
    .defineCommand('/track', function (dialog, message) {
      dialog.sendMessage(notifier.track(message.getArgument()));
    })
    .defineCommand('/untrack', function (dialog, message) {
      dialog.sendMessage(notifier.untrack(message.getArgument()));
    })
    .defineCommand('/interval', function (dialog) {
      dialog.sendMessage(notifier.interval(message.getArgument()));
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
