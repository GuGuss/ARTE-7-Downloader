var GM_xmlhttpRequest = (args) => {
  const { url, onload } = args;

  return fetch(new Request(url, args))
    .then(response => {
      return response.text()
        .then(responseText => {
          return Object.assign(response, { responseText });
        });
    })
    .then(onload);
};
