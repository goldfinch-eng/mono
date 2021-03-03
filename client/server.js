require('dotenv').config({ path: '../.env.local' });

const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.RELAY_SERVER_PORT;
const relay = require('./functions/relay').handler;

app.use(express.json());
app.use(cors());

const relayHandler = (req, res) => {
  relay({ body: JSON.stringify(req.body) }, null, (error, response) => {
    const { body, statusCode } = response;
    res.status(statusCode).send(JSON.parse(body));
  });
};

app.post('/relay', relayHandler);
app.post('.netlify/functions/relay', relayHandler);

app.listen(port, () => {
  console.log(`App listening at http://localhost:${port}`);
});
