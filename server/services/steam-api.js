'use strict';
const fetch = require('node-fetch');

const { STEAM_API_KEY, STEAM_GET_USER_SUMMARY_URL, STEAM_GET_USER_LIBRARY_URL } = require('./../config');

const { getTagsAndGenres, rateGames } = require('./steam-api-helpers');

const steamApi = {
  getRecommendations: async function (user, type) {
    try {
      const userGames = user.owned.games_owned.slice();

      if (type === 'total') {
        // Sort games by total playtime from increasing to decreasing
        userGames.sort((a, b) => {
          return b.playtime_forever - a.playtime_forever;
        });
      } else if (type === 'recent') {
        // Sort games by total playtime from increasing to decreasing (can also do this by recently played).
        userGames.sort((a, b) => {
          return b.playtime_2weeks - a.playtime_2weeks;
        });
      }

      // Gets all tags and genres of top three games as arrays. topTagsAndGenres returns an array with two entries, first is an array of tags, second is an array of genres.
      const [tags, genres] = await getTagsAndGenres(userGames.slice(0, 3));

      // Rates unplayed games by recommendation algorithm. Returns array of unplayed games in the order of the highest rating to lowest rating. (Rating is not added to objects);
      const ratedUnplayed = await rateGames(user.owned.games_unplayed, tags, genres);

      // Returns top three recommendations
      return ratedUnplayed.slice(0, 3);
    } catch (error) {
      console.log(error);
      throw error;
    }
  },

  getUserSummary: function (steamId) {
    return this.fetchRequest(`${STEAM_GET_USER_SUMMARY_URL}/?key=${STEAM_API_KEY}&steamids=${steamId}`)
  },

  getUserLibrary: function (steamId) {
    return this.fetchRequest(`${STEAM_GET_USER_LIBRARY_URL}/?key=${STEAM_API_KEY}&steamid=${steamId}&format=json&include_appinfo=true`)
  },

  fetchRequest: (path, options) => {
    return fetch(path, options)
      .then((res) => (res.ok ? res : Promise.reject(res)))
      .then((res) => (res.status !== 204 ? res.json() : res))
      .catch(
        (err) => {
          // console.log(`Error fetching [${options ? options.method : `GET`}]`, err)
        }
      );
  },
};

module.exports = steamApi;
