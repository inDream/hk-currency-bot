module.exports = function(sequelize, DataTypes) {
  var stat = sequelize.define('stat', {
    code: DataTypes.TEXT,
    bank: DataTypes.TEXT,
    reverse: DataTypes.BOOLEAN,
    count: DataTypes.INTEGER
  });

  return stat;
};
