require('express-async-errors');
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const pool = require('./db/pool');
const { ensureAuthenticated } = require('./middleware/auth');
const path = require('path');
const authRouter = require('./routes/auth');
const usersRouter = require('./routes/users');
const accountsRouter = require('./routes/accounts');
const contactsRouter = require('./routes/contacts');
const dealsRouter = require('./routes/deals');
const notesRouter = require('./routes/notes');
const attachmentsRouter = require('./routes/attachments');
const activitiesRouter = require('./routes/activities');

const PgSession = require('connect-pg-simple')(session);

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(session({
  store: new PgSession({ pool, tableName: 'session' }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  },
}));

passport.use(new GoogleStrategy(
  {
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL,
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      if (!profile._json.email_verified) {
        return done(null, false, { message: 'email_not_verified' });
      }
      const email = profile.emails[0].value.toLowerCase();
      const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
      if (!rows[0]) {
        return done(null, false, { message: 'access_denied' });
      }
      const user = rows[0];
      if (!user.google_id) {
        await pool.query('UPDATE users SET google_id = $1 WHERE id = $2', [profile.id, user.id]);
        user.google_id = profile.id;
      }
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }
));

passport.serializeUser((user, done) => done(null, user.id));

passport.deserializeUser(async (id, done) => {
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    done(null, rows[0] || false);
  } catch (err) {
    done(err);
  }
});

app.use(passport.initialize());
app.use(passport.session());

app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.use('/api/v1', ensureAuthenticated);
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/accounts', accountsRouter);
app.use('/api/v1/contacts', contactsRouter);
app.use('/api/v1/deals', dealsRouter);
app.use('/api/v1/notes', notesRouter);
app.use('/api/v1/attachments', attachmentsRouter);
app.use('/api/v1/activities', activitiesRouter);

app.use('/', authRouter);

if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

module.exports = app;
