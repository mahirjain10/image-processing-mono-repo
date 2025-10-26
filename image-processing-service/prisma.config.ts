import path from 'path';
import { defineConfig } from 'prisma/config';
import dotenv from 'dotenv';

dotenv.config();

export default defineConfig({
  schema: path.join('./src/shared/prisma', 'schema'),
  migrations: {
    path: path.join('./src/shared/prisma', 'migrations'),
  },
});
