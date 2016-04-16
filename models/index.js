'use strict';

const fs = require('fs');
const path = require('path');

const lodash = require('lodash');
const Sequelize = require('sequelize');
let isWin = /^win/.test(process.platform);

class DataStore {
  constructor(config) {
    this.config = config;
  }

  init() {
    let sequelize = new Sequelize(this.config, {
      native: !isWin,
      logging: false
    });

    let db = {};
    return sequelize
      .authenticate()
      .then(function(err) {
        if (!!err) {
          console.log('Unable to connect to the database:', err);
        } else {
          console.log('Connected to postgres database.');
        }
        return true;
      })
      .then(function() {
        return new Promise(function(resolve) {
          fs.readdirSync('./models').forEach(function(file) {
            if (file == 'index.js') {
              return;
            }

            let model = sequelize.import(path.join(__dirname, file));
            db[model.name] = model;
          });

          return resolve(sequelize.sync());
        });
      })
      .then(function() {
        return Object.assign({
          sequelize: sequelize,
          Sequelize: Sequelize
        }, db);
      });
  }
};

module.exports = DataStore;
