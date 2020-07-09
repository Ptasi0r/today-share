const express = require('express');
const querystring = require('querystring');
const fetch = require('node-fetch');
const exphbs = require('express-handlebars');
const path = require('path');
require('dotenv').config();

const app = express();
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_ID_SECRET = process.env.CLIENT_ID_SECRET;
const PORT = process.env.PORT || 5000;
const publicPath = path.join(__dirname, '../../public');

const redirect_url = process.env.REDIRECT_URI || `http://localhost:${PORT}/main`;

app.engine('handlebars', exphbs({ defaultLayout: 'main' }));
app.set('view engine', 'handlebars');

app.listen(PORT, () => {
  console.log(`🎉 Server is running at port: ${PORT}`);
});

app.get('/', (req, res) => {
  res.render('index');
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/login', (req, res) => {
  res.redirect(
    'https://accounts.spotify.com/authorize?' +
      querystring.stringify({
        response_type: 'code',
        client_id: CLIENT_ID,
        scope: 'user-read-private user-read-email',
        redirect_uri: redirect_url,
      })
  );
});

app.get('/main', async (req, res) => {
  code = req.query.code || null;
  if (code) {
    const TOKEN_URL = 'https://accounts.spotify.com/api/token';
    const PROFILE_URL = 'https://api.spotify.com/v1/me';
    const data = {
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirect_url,
      client_secret: CLIENT_ID_SECRET,
      client_id: CLIENT_ID,
    };

    const token_res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(data),
    });
    const res_data = await token_res.json();

    const res_profile = await fetch(PROFILE_URL, {
      method: 'GET',
      headers: {
        Authorization: `${res_data['token_type']} ${res_data['access_token']}`,
      },
    });
    const profile_data = await res_profile.json();

    console.log(profile_data);
    console.log(`Cześć ${profile_data['display_name']}`);
    res.render('playlist', {
      name: profile_data['display_name'],
    });
    //TODO: 1. Pobrać playlisty
    //TODO 2. Wyrenderować informację na stronie + nazwa użytkownika i jego zdjęcie
    //TODO 3. Sprawdzanie statusu w przypadku błędu informacja
    //TODO 4. Przed każdym zapytaniem odświerzenie tokenu
  } else {
    // TODO: przenieś na stonę o błedzie
  }
});
