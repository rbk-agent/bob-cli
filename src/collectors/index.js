// Ordered registry — drives both command registration and `all`.
module.exports = [
  require('./os'),
  require('./cpu'),
  require('./volumes'),
  require('./devices'),
  require('./network'),
  require('./bluetooth'),
  require('./audio'),
  require('./ssh'),
  require('./services'),
  require('./software'),
];