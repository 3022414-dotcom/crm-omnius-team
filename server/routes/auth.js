const express = require('express');
const passport = require('passport');

const router = express.Router();

router.get('/', (req, res) => {
  const error = req.query.error;
  let errorHtml = '';
  if (error === 'access_denied') {
    errorHtml = '<p style="color:red">Доступ запрещён. Обратитесь к администратору.</p>';
  } else if (error === 'email_not_verified') {
    errorHtml = '<p style="color:red">Google-аккаунт не подтверждён. Обратитесь в поддержку Google.</p>';
  } else if (error === 'oauth_cancelled') {
    errorHtml = '<p style="color:red">Вход отменён. Попробуйте снова.</p>';
  }

  res.send(`<!DOCTYPE html>
<html lang="ru">
<head><meta charset="UTF-8"><title>omnius.team CRM</title></head>
<body>
  <h1>omnius.team CRM</h1>
  ${errorHtml}
  <a href="/auth/google">Войти через Google</a>
</body>
</html>`);
});

router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/auth/google/callback', (req, res, next) => {
  passport.authenticate('google', (err, user, info) => {
    if (err) return next(err);
    if (!user) {
      const error = info?.message || 'access_denied';
      const frontendUrl = process.env.FRONTEND_URL || '';
      return res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(error)}`);
    }
    req.logIn(user, (loginErr) => {
      if (loginErr) return next(loginErr);
      res.redirect(process.env.FRONTEND_URL || '/');
    });
  })(req, res, next);
});

router.get('/auth/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    res.redirect(`${process.env.FRONTEND_URL || ''}/login`);
  });
});

module.exports = router;
