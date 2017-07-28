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

function challengeMe(error) {
  return _instagramPrivateApi.V1.Web.Challenge.resolve(error).then(function (challenge) {
    // challenge instanceof Client.Web.Challenge
    console.log(challenge.type);
    // can be phone or email
    // let's assume we got phone
    if (!challenge.type !== 'phone') return;
    //Let's check if we need to submit/change our phone number
    return challenge.phone('+10123456789');
  }).then(function (challenge) {
    // Ok we got to the next step, the response code expected by Instagram
    return challenge.code('123456');
  }).then(function (challenge) {
    // And we got the account confirmed!
    // so let's login again
    return 'some';
    // return loginAndFollow(device, storage, user, password);
  });
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

  return _instagramPrivateApi.V1.Session.create(device, storage, user, pass).catch(_instagramPrivateApi.V1.Exceptions.CheckpointError, function (error) {
    // Ok now we know that Instagram is asking us to
    // prove that we are real users
    return challengeMe(error);
  }).then(function (session) {
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
  var port = process.env.PORT || 3000;
  app.listen(port);
  console.log('Express started on port ' + port);
}