import { config } from 'dotenv';
import path, { join } from 'path';
import { defineConfig } from 'prisma/config';
import dotenv from 'dotenv';

dotenv.config();

const envFile = process.env.NODE_ENV === 'dev' ? '.env.dev' : '.env.docker';
config({ path: envFile });

export default defineConfig({
  schema: path.join('./src/shared/prisma', 'schema'),
  migrations: {
    path: path.join('./src/shared/prisma', 'migrations'),
  },
});
