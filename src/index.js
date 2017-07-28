import express from 'express'
import { V1 as InstagramV1 } from 'instagram-private-api'
import cookieParser from 'cookie-parser'

import _ from 'underscore'
import Promise from 'bluebird'

const app = express()
app.use(cookieParser())

function error(status, msg) {
  var err = new Error(msg);
  err.status = status;
  return err;
}

let device, storage, InstagramSession, InstagramAccount

app.get('/api/instagram/login', (req, res, next) => {

  const user = req.query['user']
  const pass = req.query['pass']
  
  device = new InstagramV1.Device(user)
  storage = new InstagramV1.CookieFileStorage(__dirname + `/../.cookies/instagram-${user}.json`)

  return InstagramV1.Session.create(device, storage, user, pass)
    .then((session) => {
      InstagramSession = session
      return InstagramV1.Account.searchForUser(session, user)
    })
    .then(function (account) {
      res.json(account.params)
    })
})

app.use(function (req, res, next) {
  if (!InstagramSession) {
    res.status(401)
    res.send({ error: '401, login required' })
  } else next()
})

app.get('/api/instagram/nonfollows', (req, res, next) => {
  return storage.getAccountId()
    .then((accountId) => {
      const followersFeed = new InstagramV1.Feed.AccountFollowers(InstagramSession, accountId)
      const followingFeed = new InstagramV1.Feed.AccountFollowing(InstagramSession, accountId)

      return Promise.all([
        Promise.mapSeries(_.range(0, 100), () => followersFeed.get()),
        Promise.mapSeries(_.range(0, 100), () => followingFeed.get()),
      ])
    })
    .then((results) => {
      const followers = results[0][0].map((r) => r.params)
      const following = results[1][0].map((r) => r.params)
      const followersIds = followers.map((f) => f.id)

      const nonfollows = following.filter((f) => (followersIds.indexOf(f.id) === -1))

      res.json(nonfollows)
    })
})

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
  const port = process.env.PORT || 3000
  app.listen(port);
  console.log(`Express started on port ${port}`);
}