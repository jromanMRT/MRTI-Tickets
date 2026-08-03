import dotenv from 'dotenv';
dotenv.config();

import { createApp } from './app';

const port = process.env.PORT || 4000;

const app = createApp();

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`MRTI-Tickets API listening on port ${port}`);
});
