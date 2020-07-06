const BASE_URL = 'http://localhost:3001'

export default {

  getUserInfo:  (id) => {
    return  fetchRequest(`user/${id}`);
  },
  getRecommendations: (id) => {
    return fetchRequest(`recommendations/${id}`);
  },
  getUserStore: (id) => {
    return fetchRequest(`user/store/${id}`);
  },

  setUserFavourites: (favs, id) => {
    const headers = {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      method: "PUT",
      body: JSON.stringify({favourites: favs})
    }
    return fetchRequest(`user/favourites/${id}`, headers);
  }

};

const fetchRequest = (url, headers) => {
  return fetch(`${BASE_URL}/${url}`, headers)
    .then(res => res.status <= 400 ? res : Promise.reject(res))
    .then(res => res.json())
    .catch((err) => {
      console.log(`${err.message} while fetching /${url}`)
    });
};