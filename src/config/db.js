const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');

dotenv.config();

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
});

const wait = (ms) => new Promise((res) => setTimeout(res, ms));

/**
 * Connect to DB with retries. If initial retries fail, schedule background retries
 * so the process does not exit and can reconnect later.
 */
const connectDB = async (retries = 5, delay = 5000) => {
  for (let i = 0; i < retries; i++) {
    try {
      await sequelize.authenticate();
      console.log('PostgreSQL Connected successfully.');
      return;
    } catch (error) {
      console.error(`Postgres connect attempt ${i + 1} failed:`, error.message || error);
      if (i < retries - 1) {
        console.log(`Retrying in ${delay}ms...`);
        await wait(delay);
      } else {
        console.error('Initial connect attempts failed — will keep retrying in background.');
        (async function backgroundRetry() {
          while (true) {
            try {
              await wait(delay);
              await sequelize.authenticate();
              console.log('PostgreSQL reconnected.');
              break;
            } catch (e) {
              console.error('Background reconnect attempt failed:', e.message || e);
            }
          }
        })();
        return;
      }
    }
  }
};

module.exports = { sequelize, connectDB };