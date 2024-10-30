const express = require('express');
const axios = require('axios');
const app = express();

// Add middleware to parse JSON bodies
app.use(express.json());

async function syncOpenTable(req, res) {
  console.log('Function invoked with request:', JSON.stringify(req.body));

  const { state = {}, secrets, customPayload } = req.body;
  const { clientId, clientSecret, rid } = secrets;

  try {
    // Initialize or update state
    let currentState = {
      lastSyncTimestamp: state.lastSyncTimestamp || null,
      offset: state.offset || 0,
      accessToken: state.accessToken,
      tokenExpiration: state.tokenExpiration
    };

    // Check if token is expired and refresh if necessary
    if (!currentState.accessToken || new Date() >= new Date(currentState.tokenExpiration)) {
      console.log('Refreshing access token');
      const tokenResponse = await getAccessToken(clientId, clientSecret);
      currentState.accessToken = tokenResponse.access_token;
      currentState.tokenExpiration = new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString();
    }

    // Prepare API call parameters
    const limit = 100;
    const updatedAfter = currentState.lastSyncTimestamp 
      ? new Date(new Date(currentState.lastSyncTimestamp) - 2 * 24 * 60 * 60 * 1000).toISOString() // always get data from at least two days prior, to make sure we always capture any changes.
      : undefined;

    // Fetch guests data
    console.log('Fetching guests data');
    const guestsResponse = await fetchData('guests', currentState.accessToken, rid, limit, currentState.offset, updatedAfter);
    
    // Fetch reservations data
    console.log('Fetching reservations data');
    const reservationsResponse = await fetchData('reservations', currentState.accessToken, rid, limit, currentState.offset, updatedAfter);

    const hasMore = guestsResponse.hasNextPage || reservationsResponse.hasNextPage;

    // Determine the latest updated_at_utc
    const latestGuestTimestamp = guestsResponse.items.length > 0 ? guestsResponse.items[guestsResponse.items.length - 1].updated_at_utc : null;
    const latestReservationTimestamp = reservationsResponse.items.length > 0 ? reservationsResponse.items[reservationsResponse.items.length - 1].updated_at_utc : null;
    const latestTimestamp = [latestGuestTimestamp, latestReservationTimestamp].filter(Boolean).sort().pop();

    // Prepare response for Fivetran
    const fivetranResponse = {
      state: {
        ...currentState,
        offset: hasMore ? currentState.offset + limit : 0
      },
      insert: {
        guests: guestsResponse.items,
        reservations: reservationsResponse.items
      },
      schema: {
        guests: { primary_key: ['id'] },
        reservations: { primary_key: ['id'] }
      },
      hasMore: hasMore
    };

    // Update lastSyncTimestamp when the sync is complete
    if (!hasMore && latestTimestamp) {
      fivetranResponse.state.lastSyncTimestamp = latestTimestamp;
    }

    console.log('Sending response to Fivetran:', JSON.stringify(fivetranResponse));
    res.json(fivetranResponse);
  } catch (error) {
    console.error('Error in syncOpenTable function:', error);
    res.status(500).json({
      errorMessage: error.message,
      errorType: error.name,
      stackTrace: error.stack
    });
  }
}

async function getAccessToken(clientId, clientSecret) {
  try {
    const response = await axios.post('https://oauth.opentable.com/api/v2/oauth/token', 
      'grant_type=client_credentials',
      {
        auth: {
          username: clientId,
          password: clientSecret
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error getting access token:', error);
    throw new Error(`Failed to get access token: ${error.message}`);
  }
}

async function fetchData(endpoint, accessToken, rid, limit, offset, updatedAfter) {
  try {
    const url = `https://platform.opentable.com/sync/v2/${endpoint}`;
    const params = {
      rid,
      limit,
      offset
    };

    if (updatedAfter) {
      params.updated_after = updatedAfter;
    }

    const response = await axios.get(url, {
      params,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data;
  } catch (error) {
    console.error(`Error fetching ${endpoint} data:`, error);
    throw new Error(`Failed to fetch ${endpoint} data: ${error.message}`);
  }
}

// Set up the routes
app.post('/', syncOpenTable);

// Add a health check endpoint
app.get('/_health', (req, res) => {
  res.status(200).send('OK');
});

// Start the server
const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});