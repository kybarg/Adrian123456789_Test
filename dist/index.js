'use strict';

var _express = require('express');

var _express2 = _interopRequireDefault(_express);

var _instagramPrivateApi = require('instagram-private-api');

var _cookieParser = require('cookie-parser');

var _cookieParser2 = _interopRequireDefault(_cookieParser);

var _underscore = require('underscore');

var _underscore2 = _interopRequireDefault(_underscore);

var _bluebird = require('bluebird');

var _bluebird2 = _interopRequireDefault(_bluebird);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var app = (0, _express2.default)();
app.use((0, _cookieParser2.default)());

function error(status, msg) {
  var err = new Error(msg);
  err.status = status;
  return err;
}

var device = void 0,
    storage = void 0,
    InstagramSession = void 0,
    InstagramAccount = void 0;

app.get('/api/instagram/login', function (req, res, next) {

  var user = req.query['user'];
  var pass = req.query['pass'];

  device = new _instagramPrivateApi.V1.Device(user);
  storage = new _instagramPrivateApi.V1.CookieFileStorage(__dirname + ('/../.cookies/instagram-' + user + '.json'));

  return _instagramPrivateApi.V1.Session.create(device, storage, user, pass).then(function (session) {
    InstagramSession = session;
    return _instagramPrivateApi.V1.Account.searchForUser(session, user);
  }).then(function (account) {
    res.json(account.params);
  });
});

app.use(function (req, res, next) {
  if (!InstagramSession) {
    res.status(401);
    res.send({ error: '401, login required' });
  } else next();
});

app.get('/api/instagram/nonfollows', function (req, res, next) {
  return storage.getAccountId().then(function (accountId) {
    var followersFeed = new _instagramPrivateApi.V1.Feed.AccountFollowers(InstagramSession, accountId);
    var followingFeed = new _instagramPrivateApi.V1.Feed.AccountFollowing(InstagramSession, accountId);

    return _bluebird2.default.all([_bluebird2.default.mapSeries(_underscore2.default.range(0, 100), function () {
      return followersFeed.get();
    }), _bluebird2.default.mapSeries(_underscore2.default.range(0, 100), function () {
      return followingFeed.get();
    })]);
  }).then(function (results) {
    var followers = results[0][0].map(function (r) {
      return r.params;
    });
    var following = results[1][0].map(function (r) {
      return r.params;
    });
    var followersIds = followers.map(function (f) {
      return f.id;
    });

    var nonfollows = following.filter(function (f) {
      return followersIds.indexOf(f.id) === -1;
    });

    res.json(nonfollows);
  });
});

app.use(function (err, req, res, next) {
  res.status(err.status || 500);
  res.send({ error: err.message });
});

app.use(function (req, res) {
  res.status(404);
  res.send({ error: '404, not found' });
});

/* istanbul ignore next */
if (!module.parent) {
  app.listen(3000);
  console.log('Express started on port 3000');
}