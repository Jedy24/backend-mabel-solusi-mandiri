import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const prismaCli = join(dirname(require.resolve('prisma/package.json')), 'build', 'index.js');

export default async function setup({ provide }) {
    const folder = await mkdtemp(join('prisma', '.test-'));
    const databaseUrl = 'file:./' + basename(folder) + '/tests.db';
    const env = { ...process.env, DATABASE_URL: databaseUrl };

    try {
        execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy'], { env, stdio: 'inherit' });
        execFileSync(process.execPath, ['prisma/seed.js'], { env, stdio: 'inherit' });
    } catch (error) {
        await rm(folder, { recursive: true, force: true });
        throw error;
    }

    provide('databaseUrl', databaseUrl);
    return () => rm(folder, { recursive: true, force: true });
}
