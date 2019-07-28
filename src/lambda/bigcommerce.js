const axios = require("axios")
const cookie = require('cookie');
const setCookie = require('set-cookie-parser')

export function handler(event, context, callback) {
  console.log(" ")
  console.log(" ")
  console.log(" ")
  console.log("-----------------------")
  console.log("----- New Request -----")
  console.log("-----------------------")
  // console.log("Event: ", event)

  // Get env var values we need to speak to the BC API
  const { API_STORE_HASH, API_CLIENT_ID, API_TOKEN, API_SECRET, CORS_ORIGIN } = process.env
  // Set up headers
  const REQUEST_HEADERS = {
    'X-Auth-Client': API_CLIENT_ID,
    'X-Auth-Token': API_TOKEN,
    'Accept': 'application/json'
  }
  const CORS_HEADERS = {
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Origin': CORS_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, GET, PUT, DELETE, OPTIONS',
  }
  // Get endpoint value from query string
  const ENDPOINT_QUERY_STRING = event.queryStringParameters.endpoint

  // Parse out cookies and change endpoint to include cartId for certain cart requests
  const cookies = setCookie.parse(event.headers.cookie, {
    decodeValues: true,  // default: true
    map: true // default: false
  })
  const hasCartIdCookie = (cookies.hasOwnProperty('cartId'))
  console.log(`- hasCartIdCookie? ${hasCartIdCookie.toString()} -`)

  // Assemble BC API URL we are going to hit
  let ROOT_URL = `https://api.bigcommerce.com/stores/${API_STORE_HASH}/v3/`
  let URL = ''

  if (ENDPOINT_QUERY_STRING == 'carts/items') {
    if (hasCartIdCookie) {
      if (event.queryStringParameters.hasOwnProperty('itemId')) {
        URL = `${ROOT_URL}carts/${cookies.cartId.value}/items/${event.queryStringParameters.itemId}?include=redirect_urls`
      } else {
        URL = `${ROOT_URL}carts/${cookies.cartId.value}/items?include=redirect_urls`
      }
    } else {
      // If there is no cartId cookie when adding cart items, resort to creating the cart
      URL = `${ROOT_URL}carts?include=redirect_urls`
    }
  } else if (ENDPOINT_QUERY_STRING == 'carts') {
    if (hasCartIdCookie) {
      URL = `${ROOT_URL}carts/${cookies.cartId.value}?include=redirect_urls`
    } else {
      URL = `${ROOT_URL}carts?include=redirect_urls`
    }
  } else {
    URL = ROOT_URL + ENDPOINT_QUERY_STRING;
  }
  console.log("Constructed URL: ", URL)

  // Function to determine return cookie header that should be returned with response
  const setCookieHeader = (responseType, axiosResponse) => {
    let cookieHeader = null;

    console.log('(in setCookieHeader function) responseType: ', responseType)
    console.log('(in setCookieHeader function) ENDPOINT_QUERY_STRING: ', ENDPOINT_QUERY_STRING)

    if (typeof axiosResponse.response.status != 'undefined') {
      console.log('(in setCookieHeader function) axiosResponse.response.status: ', axiosResponse.response.status)
    } else {
      console.log('(in setCookieHeader function) axiosResponse.response.status not defined')
    }

    if (ENDPOINT_QUERY_STRING == 'carts' && typeof axiosResponse.response.status != 'undefined' && axiosResponse.response.status == 404) {
      cookieHeader = {
        'Set-Cookie': cookie.serialize('cartId', '', {
          maxAge: -1
        })
      }
      console.log("- Expiring cardId cookieHeader: -")
      console.log(cookieHeader)
    } else if (responseType == 'response') {
      let cookieHeader = null;
        
        if (!hasCartIdCookie && axiosResponse.response.data.data.id) {
          cookieHeader = {
            'Set-Cookie': cookie.serialize('cartId', axiosResponse.response.data.data.id, {
              maxAge: 60 * 60 * 24 * 28 // 4 weeks
            })
          }
          console.log("- Assigning cookieHeader: -")
          console.log(cookieHeader)
        }
    }

    return cookieHeader;
  }

  // Here's a function we'll use to define how our response will look like when we callback
  const pass = (axiosResponse, cookieHeader) => {
    console.log("-------------")
    console.log("- in pass() -")
    console.log("-------------")
    console.log(JSON.stringify(axiosResponse))

    const statusCode = axiosResponse.response.status
    const body = axiosResponse.response.data

    callback( null, {
      statusCode: statusCode,
      body: JSON.stringify(body),
      headers: {...CORS_HEADERS, ...cookieHeader }
    }
  )}

  // Process POST
  const post = (body) => {
    axios.post(URL, body, { headers: REQUEST_HEADERS })
    .then((response) =>
      {
        const cookieHeader = setCookieHeader('response', response);

        pass(response, cookieHeader)
      }
    )
    .catch(err => pass(err))
  }
  if(event.httpMethod == 'POST'){
    console.log("--------")
    console.log("- POST -")
    console.log("--------")
    post(JSON.parse(event.body))
  };

  // Process GET
  const get = () => {
    axios.get(URL, { headers: REQUEST_HEADERS })
    .then((response) =>
      {
        const cookieHeader = setCookieHeader('response', response)

        pass(response, cookieHeader)
      }
    )
    .catch(err => {
        const cookieHeader = setCookieHeader('error', err)

        pass(err, cookieHeader)
    })
  }
  if(event.httpMethod == 'GET'){
    console.log("-------")
    console.log("- GET -")
    console.log("-------")
    get()
  };

  // Process PUT
  const put = (body) => {
    axios.put(URL, body, { headers: REQUEST_HEADERS })
    .then((response) =>
      {
        pass(response)
      }
    )
    .catch(err => pass(err))
  }
  if(event.httpMethod == 'PUT'){
    console.log("-------")
    console.log("- PUT -")
    console.log("-------")
    put(JSON.parse(event.body))
  };

  // Process DELETE
  const del = () => {
    axios.delete(URL, { headers: REQUEST_HEADERS })
    .then((response) =>
      {
        pass(response)
      }
    )
    .catch(err => pass(err))
  }
  if(event.httpMethod == 'DELETE'){
    console.log("----------")
    console.log("- DELETE -")
    console.log("----------")
    del()
  };
};
