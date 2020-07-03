'use strict';

const rawgApi = require('../services/rawg-api');
const GameModel = require('../models/game');
const { TAG_WEIGHT, GENRE_WEIGHT, METACRITIC_WEIGHT } = require('../config');

// Takes an array of games and returns an array whose first index is a set of tags, and the second index is a set of genres.
const getTagsAndGenres = async (games, appIds, type) => {
  let tags = {};
  let genres = {};
  // Query DB for games by user game_ids array.
  const dbGames = await GameModel.find({ appid: { $in: appIds } });

  for (let i = 0; i < games.length; i++) {
    // Search dbGames for games[i].appid
    const game = dbGames.filter((dbGame) => dbGame.appid === games[i].appid)[0];

    /* If the game is in dbGames, then save each tag as a property in tags and combine the playtime 
    of each game that tag shows up in. Do the same for genres. Otherwise, call the rawg API. */
    if (game) {
      tags = getTagPlaytime(tags, game, games[i], type);
      genres = getGenrePlaytime(genres, game, games[i], type);
    } else {
      try {
        const appId = games[i].appid;
        // Saves a game object into our db if details can be found from Rawg API call since it did not already exist in our db.
        const dbGame = await saveGame(appId, games[i].name);
        if (dbGame.rawg) {
          tags = getTagPlaytime(tags, dbGame, games[i], type);
          genres = getGenrePlaytime(genres, dbGame, games[i], type);
        }
      } catch (error) {
        // console.error(error); // All errors are usually 404 Not Found errors.
      }
    }
  }
  return [tags, genres];
};

const rateGames = async (games, tags, genres, appIds, ratingType = 'similarity') => {
  const ratedGames = [];

  // Query DB for games by user game_ids array.
  const dbGames = await GameModel.find({ appid: { $in: appIds } });

  for (let i = 0; i < games.length; i++) {

    // Search dbGames for games[i].appid
    const game = dbGames.filter((dbGame) => dbGame.appid === games[i].appid)[0];

    // If the game is in dbGames, then apply the rating algorithm to the game and push it to ratedGames.
    if (game && game.rawg) {
      const ratedGame = rateGame(game, tags, genres, ratingType);
      ratedGames.push(ratedGame);
    } else if (!game) {
      try {
        const appId = games[i].appid;

        // Saves a game object into our db if details can be found from Rawg API call since it did not already exist in our db.
        const dbGame = await saveGame(appId, games[i].name);

        if (dbGame.rawg) {
          const ratedGame = rateGame(dbGame, tags, genres, ratingType);

          ratedGames.push(ratedGame);
        }
      } catch (error) {
        // console.error(error); // All errors are usually 404 Not Found errors.
      }
    }
  };
  ratedGames.sort((a, b) => {
    return b.rating - a.rating;
  });

  return ratedGames;
};

// Rating type switches between different rating styles. 
const rateGame = (game, tags, genres, ratingType) => {
  if (!game.name) {
    throw new Error(`Error: ${game.appid} does not have the correct data.`);
  }
  let overlappingTags = 0;
  let overlappingGenres = 0;
  let tagTime = 0;
  let genreTime = 0;
  let totalTagTime = 0;
  let totalGenreTime = 0;

  // Compare game tags to given list of tags and adds up the playtime associated to each tag. Same for genre.
  for (let j = 0; j < game.tags.length; j++) {
    if (tags[game.tags[j]]) {
      tagTime += tags[game.tags[j]];
      overlappingTags++;
    }
  }
  for (let j = 0; j < game.genres.length; j++) {
    if (genres[game.genres[j]]) {
      genreTime += genres[game.genres[j]];
      overlappingGenres++;
    }
  }

  // Find the total time of all game tags and genres.
  let tagNames = Object.keys(tags);
  for (let i = 0; i < tagNames.length; i++) {
    totalTagTime += tags[tagNames[i]];
  }

  let genreNames = Object.keys(genres);
  for (let i = 0; i < genreNames.length; i++) {
    totalGenreTime += tags[genreNames[i]];
  }

  let rating;
  let rating_reason;

  // Scores based on similar tags and genres to the given set of games, and the game's metacritic score.
  if (ratingType === 'similarity') {
    const tag_score = overlappingTags / game.tags.length ? overlappingTags / game.tags.length : 0;
    const genre_score = overlappingGenres / game.genres.length ? overlappingGenres / game.genres.length : 0;
    const metacritic_score = game.ratings.metacritic / 100;

    // If the metacritic score is null/0, exclude it from the score.
    if (metacritic_score) {
      rating = tag_score * parseFloat(TAG_WEIGHT) + genre_score * parseFloat(GENRE_WEIGHT) + metacritic_score * parseFloat(METACRITIC_WEIGHT);
    } else {
      rating = (tag_score * parseFloat(TAG_WEIGHT) + genre_score * parseFloat(GENRE_WEIGHT)) / (parseFloat(TAG_WEIGHT) + parseFloat(GENRE_WEIGHT));
    }

    console.log('\n', `   Game: ${game.name} - Tag Score: ${tag_score}, Genre Score: ${genre_score}, Metacritic: ${metacritic_score}, Rating: ${rating}`);
    console.log(`    Tag Weight: ${TAG_WEIGHT}, Genre Weight: ${GENRE_WEIGHT}, Metacritic Weight: ${METACRITIC_WEIGHT}`);

    // Sets rating reason based on which category scored the highest.
    if ((tag_score >= genre_score) && (tag_score >= metacritic_score)) {
      rating_reason = 'This game has similar tags to games that you have already played before.';
    } else if ((metacritic_score >= tag_score) && (metacritic_score >= genre_score)) {
      rating_reason = 'The metacritic score for this game is high among similar games that you have enjoyed.';
    } else if ((genre_score >= tag_score) && (genre_score >= metacritic_score)) {
      rating_reason = 'The genre of this game is similar to other genres you have played in the past.';
    }

    // This rating style emphasizes the amount of time you spent on a particular tag or genre type, weighting more heavily played tags and genres higher.
  } else if (ratingType === 'timespent') {
    const tag_score = tagTime / totalTagTime ? tagTime / totalTagTime : 0;
    const genre_score = genreTime / totalGenreTime ? genreTime / totalGenreTime : 0;
    const metacritic_score = game.ratings.metacritic / 100;

    // If the metacritic score is null/0, exclude it from the score.
    if (metacritic_score) {
      rating = tag_score * parseFloat(TAG_WEIGHT) + genre_score * parseFloat(GENRE_WEIGHT) + metacritic_score * parseFloat(METACRITIC_WEIGHT);
    } else {
      rating = (tag_score * parseFloat(TAG_WEIGHT) + genre_score * parseFloat(GENRE_WEIGHT)) / (parseFloat(TAG_WEIGHT) + parseFloat(GENRE_WEIGHT));
    }

    console.log('\n', `   Game: ${game.name} - Tag Score: ${tag_score}, Genre Score: ${genre_score}, Metacritic: ${metacritic_score}, Rating: ${rating}`);
    console.log(`    Tag Weight: ${TAG_WEIGHT}, Genre Weight: ${GENRE_WEIGHT}, Metacritic Weight: ${METACRITIC_WEIGHT}`);

    // Sets rating reason based on which category scored the highest.
    if ((tag_score >= genre_score) && (tag_score >= metacritic_score)) {
      rating_reason = 'This game has similar tags to games that you have already played before.';
    } else if ((metacritic_score >= tag_score) && (metacritic_score >= genre_score)) {
      rating_reason = 'The metacritic score for this game is high among similar games that you have enjoyed.';
    } else if ((genre_score >= tag_score) && (genre_score >= metacritic_score)) {
      rating_reason = 'The genre of this game is similar to other genres you have played in the past.';
    }
  }

  const ratedGame = {
    appid: game.appid,
    name: game.name,
    description: game.description,
    background_image: game.background_image,
    rating,
    rating_reason,
    tags: game.tags,
    genres: game.genres,
  };

  return ratedGame;
};

const saveGame = async (appId, name) => {
  const gameStub = name.replace(/\s+/g, '-').replace(/:/g, '').replace(/!/g, '').toLowerCase();
  const game = await rawgApi.getGameDetails(gameStub)

  let dbGame = {};
  if (game && game.tags && game.genres) {
    const gameTags = [];
    const gameGenres = [];
    const gameMetacritic = game.metacritic

    // Extracting Tag names from game.tags object into gameTags array.
    for (let j = 0; j < game.tags.length; j++) {
      gameTags.push(game.tags[j].name);
    }
    for (let j = 0; j < game.genres.length; j++) {
      gameGenres.push(game.genres[j].name);
    }

    // Save game properties
    dbGame.appid = appId;
    dbGame.rawg = true;
    dbGame.name = game.name;
    dbGame.background_image = game.background_image;
    dbGame.description = game.description;
    dbGame.genres = gameGenres;
    dbGame.tags = gameTags;
    dbGame.ratings = {
      metacritic: gameMetacritic,
    };

  } else {
    // Flag that the game has no rawg information.
    dbGame.appid = appId;
    dbGame.rawg = false;
  }

  await GameModel.replaceOne({
    appid: appId,
  },
    dbGame, {
    upsert: true,
  });

  return dbGame;
}

const getTagPlaytime = (oldTags, dbGame, userGame, type) => {
  const tags = Object.assign({}, oldTags);
  for (let i = 0; i < dbGame.tags.length; i++) {
    if (tags.hasOwnProperty(dbGame.tags[i])) {
      if (type === 'total') {
        tags[dbGame.tags[i]] += userGame.playtime_forever
      } else if (type === 'recent') {
        tags[dbGame.tags[i]] += userGame.playtime_2weeks
      }
    } else {
      tags[dbGame.tags[i]] = type === 'total' ? userGame.playtime_forever : userGame.playtime_2weeks;
    }
  }
  return tags;
}

const getGenrePlaytime = (oldGenres, dbGame, userGame, type) => {
  const genres = Object.assign({}, oldGenres);
  for (let i = 0; i < dbGame.genres.length; i++) {
    if (genres.hasOwnProperty(dbGame.genres[i])) {
      if (type === 'total') {
        genres[dbGame.genres[i]] += userGame.playtime_forever
      } else if (type === 'recent') {
        genres[dbGame.genres[i]] += userGame.playtime_2weeks
      }
    } else {
      genres[dbGame.genres[i]] = type === 'total' ? userGame.playtime_forever : userGame.playtime_2weeks;
    }
  }
  return genres;
}
module.exports = {
  getTagsAndGenres,
  rateGames,
  saveGame,
};
