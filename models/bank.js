module.exports = function(sequelize, DataTypes) {
  var bank = sequelize.define('bank', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: false,
      primaryKey: true,
      unique: true
    },
    name: DataTypes.TEXT
  }, {
    timestamps: false
  });

  return bank;
};
