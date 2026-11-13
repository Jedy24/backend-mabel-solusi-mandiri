require('dotenv').config();

if (!process.env.DATABASE_URL || !process.env.JWT_SECRET) {
    throw new Error('Set DATABASE_URL and JWT_SECRET in .env before starting Visit Flow.');
}

const app = require('./app');
const port = Number(process.env.PORT || 3001);
app.listen(port, () => console.log('Visit Flow API listening on port ' + port));
