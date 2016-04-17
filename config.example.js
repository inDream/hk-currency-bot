var availCurrencies = ['AED', 'AUD', 'BDT', 'BHD', 'BND', 'CAD', 'CHF', 'CNH',
  'CNY', 'CZK', 'DKK', 'EGP', 'EUR', 'FJD', 'GBP', 'HUF', 'IDR', 'ILS', 'INR',
  'JOD', 'JPY', 'KRW', 'KWD', 'LKR', 'MOP', 'MUR', 'MXN', 'MYR', 'NOK', 'NZD',
  'OMR', 'PGK', 'PHP', 'PLN', 'RUB', 'SAR', 'SEK', 'SGD', 'THB', 'TRY', 'TWD',
  'USD', 'VND', 'ZAR'];

var pg = {
  host: '',
  user: '',
  pass: '',
  table: ''
};
var pgUrl = 'postgres://' + pg.user + ':' + pg.pass + '@' + pg.host + '/' + pg.table;

module.exports = {
  availCurrencies: availCurrencies,
  botname: '',
  pg: pgUrl,
  pythonPath: '',
  webhook: {
    port: 0,
    path: '',
    url: ''
  },
  token: {
    telegram: '',
    botan: ''
  }
};
