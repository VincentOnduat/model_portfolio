import { createApp } from './app.js';
import { env } from './lib/env.js';

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`Model Portfolio API listening on http://localhost:${env.PORT}`);
});
