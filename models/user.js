module.exports = function(sequelize, DataTypes) {
  var user = sequelize.define('user', {
    userid: DataTypes.INTEGER,
    groupid: DataTypes.INTEGER,
    interval: DataTypes.INTEGER,
    codes: DataTypes.ARRAY(DataTypes.TEXT),
    lastdate: DataTypes.ARRAY(DataTypes.DATE)
  });

  return user;
};
