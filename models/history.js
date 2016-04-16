module.exports = function(sequelize, DataTypes) {
  var history = sequelize.define('history', {
    bank: DataTypes.TEXT,
    code: DataTypes.TEXT,
    // s = sell, b = buy
    // tt = telegraphic transfer, nt = notes
    stt: DataTypes.REAL,
    snt: DataTypes.REAL,
    btt: DataTypes.REAL,
    bnt: DataTypes.REAL,
    ts: DataTypes.DATE,
  }, {
    timestamps: false
  });

  return history;
};
