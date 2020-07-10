const express = require('express');
const querystring = require('querystring');
const fetch = require('node-fetch');
const exphbs = require('express-handlebars');
const path = require('path');
const url = require('url');
require('dotenv').config();

const app = express();
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_ID_SECRET = process.env.CLIENT_ID_SECRET;
const PORT = process.env.PORT || 5000;
const publicPath = path.join(__dirname, '../../public');

const redirect_url = process.env.URL_HEROKU || `http://localhost:${PORT}/main`;

app.engine('handlebars', exphbs({ defaultLayout: 'main' }));
app.set('view engine', 'handlebars');

app.get('/rasterizeHTML.allinone.js', function (req, res) {
  res.sendFile(__dirname + '/node_modules/rasterizehtml/dist/rasterizeHTML.allinone.js');
});

app.get('/FileSaver.js', function (req, res) {
  res.sendFile(__dirname + '/node_modules/file-saver/dist/FileSaver.js');
});

const token_refresh = async (token_to_refresh) => {
  if (refresh_token == null) {
    res.render('error', {
      msg: 'Error, try log in again',
    });
  }

  const TOKEN_URL = 'https://accounts.spotify.com/api/token';
  const data = {
    grant_type: 'refresh_token',
    refresh_token: token_to_refresh,
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
  const date = new Date();
  const expire_date = new Date(date.getTime + token_res['expires_in'] * 1000).getTime();

  console.log('tuatj ' + res_data['access_token'] + expire_date);
  return [res_data['access_token'], expire_date];
};

app.listen(PORT, () => {
  console.log(`🎉 Server is running at port: ${PORT}`);
});

app.get('/', (req, res) => {
  res.render('index');
});

app.get('/error', (req, res) => {
  res.render('error', {
    msg: 'Error, try log in again',
  });
});

app.use(express.static(path.join(__dirname, 'public')));
app.use('/logo.png', express.static(path.join(__dirname, 'public/img/logo.png')));

app.get('/login', (req, res) => {
  res.redirect(
    'https://accounts.spotify.com/authorize?' +
      querystring.stringify({
        response_type: 'code',
        client_id: CLIENT_ID,
        scope: 'user-read-private user-read-email playlist-read-private playlist-read-collaborative',
        redirect_uri: redirect_url,
      })
  );
});

app.get('/main', async (req, res) => {
  code = req.query.code || null;
  if (code) {
    const TOKEN_URL = 'https://accounts.spotify.com/api/token';

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
    const date = new Date().getTime();
    const expire_date = new Date(date + res_data['expires_in'] * 1000).getTime();

    if (res_data['error']) {
      res.render('error', {
        msg: 'Error, try log in again',
      });
    } else {
      console.log(res_data);
      res.redirect(
        url.format({
          pathname: '/playlists',
          query: {
            token_type: res_data['token_type'],
            access_token: res_data['access_token'],
            refresh_token: res_data['refresh_token'],
            expire_date: expire_date,
          },
        })
      );
    }
  } else {
    res.render('error', {
      msg: 'Error, try log in again',
    });
  }
});

app.get('/playlists', async (req, res) => {
  let { token_type, access_token, refresh_token, expire_date } = req.query;
  console.log(req.query);
  //check if current date < expire date of token
  const now = new Date().getTime();
  console.log(now, expire_date);
  if (now >= expire_date) {
    return_values = await token_refresh(refresh_token);
    access_token = return_values[0];
    expire_date = return_values[1];
    refresh_token = null;
  }

  // Send request for user profile
  const PROFILE_URL = 'https://api.spotify.com/v1/me';
  const res_profile = await fetch(PROFILE_URL, {
    method: 'GET',
    headers: {
      Authorization: `${token_type} ${access_token}`,
    },
  });

  const profile_data = await res_profile.json();

  //Send request for user's playlists
  const PLAYLIST_LIST_URL = 'https://api.spotify.com/v1/me/playlists';
  const res_playlists = await fetch(PLAYLIST_LIST_URL, {
    method: 'GET',
    headers: {
      Authorization: `${token_type} ${access_token}`,
    },
  });

  let playlists = await res_playlists.json();
  playlists = playlists['items'];

  const playlists_data = playlists.map((el) => {
    return {
      name: el['name'],
      tracks: el['tracks']['total'],
      cover: el['images'][0],
      id: el['id'],
    };
  });
  playlists_data.sort((a, b) => {
    if (a['tracks'] > b['tracks']) {
      return -1;
    } else if (a['tracks'] < b['tracks']) {
      return 1;
    } else {
      return 0;
    }
  });
  console.log(playlists_data[0]['tracks'], playlists_data[1]['tracks'], playlists_data[0]['tracks'] > playlists_data[1]['tracks']);

  res.render('playlists', {
    name: profile_data['display_name'],
    avatar: profile_data['images'][0]['url'],
    playlists: playlists_data,
    token_type: token_type,
    access_token: access_token,
    expire_date: expire_date,
    refresh_token: refresh_token || null,
  });
});

app.get('/song', async (req, res) => {
  let { token_type, access_token, expire_date, refresh_token, playlist_id, user, avatar } = req.query;

  const now = new Date().getTime();
  // console.log(now, expire_date);
  if (now >= expire_date) {
    return_values = await token_refresh(refresh_token);
    access_token = return_values[0];
    expire_date = return_values[1];
    refresh_token = null;
  }

  const PLAYLISTS_TRACKS_URL = `https://api.spotify.com/v1/playlists/${playlist_id}/tracks`;

  let res_playlists_tracks = await fetch(PLAYLISTS_TRACKS_URL, {
    method: 'GET',
    headers: {
      Authorization: `${token_type} ${access_token}`,
    },
  });

  let playlist_tracks_data = await res_playlists_tracks.json();
  const playlists_tracks = playlist_tracks_data['items'];

  while (playlist_tracks_data['next']) {
    res_playlists_tracks = await fetch(playlist_tracks_data['next'], {
      method: 'GET',
      headers: {
        Authorization: `${token_type} ${access_token}`,
      },
    });
    playlist_tracks_data = await res_playlists_tracks.json();
    tracks = playlist_tracks_data['items'];
    tracks.forEach((el) => {
      playlists_tracks.push(el);
    });
  }
  // console.log(playlists_tracks.length);
  // console.log(playlists_tracks[0]);
  const song = playlists_tracks[Math.floor(Math.random() * playlists_tracks.length)]['track'];
  console.log(song['artists']);
  console.log(song['album']['images']);
  artists = [];

  song['artists'].forEach((el) => {
    artists.push(el.name);
  });

  const song_map = {
    name: song['name'],
    album: song['album']['name'],
    artists: artists.join(', '),
    id: song['album']['id'],
    image: song['album']['images'][1]['url'],
    href: song['external_urls']['spotify'],
  };

  const PROFILE_URL = 'https://api.spotify.com/v1/me';
  const res_profile = await fetch(PROFILE_URL, {
    method: 'GET',
    headers: {
      Authorization: `${token_type} ${access_token}`,
    },
  });

  const profile_data = await res_profile.json();

  console.log(user, avatar);
  res.render('song', {
    token_type: token_type,
    access_token: access_token,
    expire_date: expire_date,
    refresh_token: refresh_token || null,
    song: song_map,
    name: profile_data['display_name'],
    avatar: profile_data['images'][0]['url'],
  });
});
