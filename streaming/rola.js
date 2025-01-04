import {
  randomBytes,
  createHash,
  createDecipheriv,
  createCipheriv,
} from 'node:crypto';

import { Rola } from '@radixdlt/rola';
import { createRestAPIClient } from 'masto';
import { ResultAsync } from 'neverthrow';

import { redisConfig, redisClient, pgPool } from './index.js';
import { logger } from './logging.js';

const secureRandom = (byteCount) =>
  randomBytes(byteCount).toString('hex');


const encryptionMethod = "aes-256-ecb"; // Define the encryption method

// Retrieve the secret key from environment variables
const secretKey = process.env.SELFI_SECRET_KEY || "default_secret_key";

// Generate a 32-byte key
const key = createHash("sha256")
  .update(secretKey)
  .digest("base64")
  .slice(0, 32);

// Encrypt data
export function encryptData(data) {
  const cipher = createCipheriv(encryptionMethod, key, null); // ECB mode does not use an IV
  const encrypted = Buffer.concat([
    new Uint8Array(cipher.update(data, "utf8")),
    new Uint8Array(cipher.final()),
  ]);
  return encrypted.toString("hex");
}

// Decrypt data
export function decryptData(encryptedData) {
  const decipher = createDecipheriv(encryptionMethod, key, null); // ECB mode does not use an IV
  const decrypted = Buffer.concat([
    new Uint8Array(
      decipher.update(new Uint8Array(Buffer.from(encryptedData, "hex"))),
    ),
    new Uint8Array(decipher.final()),
  ]);
  return decrypted.toString("utf8");
}

const fetchUsername = (pgPool, username) => {
  return new Promise((resolve, reject) => {
    pgPool.connect((err, client, done) => {
      if (err || !client) {
        reject(err);
        return;
      }

      client.query(`
SELECT username
FROM accounts
WHERE username = $1 LIMIT 1
`, [username], (err, result) => {
        done();

        if (err) {
          reject(err);
          return;
        }

        resolve(result.rows);
      });
    });
  });
};

const insertRolaInfo = async (pgPool, persona, username, email, password) => {
  return new Promise((resolve, reject) => {
    pgPool.connect((err, client, done) => {
      if (err || !client) {
        reject(err);
        return;
      }

      client.query(`
INSERT INTO rola_infos (persona, username, email, password, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6)
`, [persona, username, email, encryptData(password), new Date().toISOString(), new Date().toISOString()], (err, result) => {
        done();

        if (err) {
          reject(err);
          return;
        }

        resolve(result.rows);
      });
    });
  });
};

const getRolaInfo = async (pgPool, persona) => {
  return new Promise((resolve, reject) => {
    pgPool.connect((err, client, done) => {
      if (err || !client) {
        reject(err);
        return;
      }

      client.query(`
SELECT username, email, password
FROM rola_infos
WHERE persona = $1 LIMIT 1
      `, [persona], (err, result) => {
        done();

        if (err) {
          reject(err);
          return;
        }

        resolve(result.rows);
      });
    });
  });
};

export const deleteMastodonAccount = async (accountId) => {
  return fetch(`${process.env.SELFI_MASTODON_API_URL}/api/v1/accounts/${accountId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${process.env.SELFI_ACCESS_TOKEN}`,
    },
  }).then((r) => r.json())
    .catch(() => null);
};

const masto = createRestAPIClient({
  url: process.env.SELFI_MASTODON_API_URL,
  accessToken: process.env.SELFI_ACCESS_TOKEN,
});

// A simple in-memory store for challenges. A database should be used in production.
export const ChallengeStore = () => {
  const create = () => {
    const challenge = secureRandom(32); // 32 random bytes as hex string
    const expires = Date.now() + 1000 * 60 * 5; // expires in 5 minutes

    logger.info(`${redisConfig.namespace}challenge:${challenge}`, 'creating challenge ');
    redisClient.set(`${redisConfig.namespace}challenge:${challenge}`, expires, 'EX', expires);

    return challenge;
  };

  const verify = async (input) => {
    const expiry = await redisClient.get(`${redisConfig.namespace}challenge:${input}`);

    if (!expiry) return false;

    const isValid = expiry > Date.now(); // check if challenge has expired

    return isValid;
  };

  return { create, verify };
};

const { verifySignedChallenge } = Rola({
  applicationName: process.env.ROLA_APPLICATION_NAME,
  dAppDefinitionAddress: process.env.ROLA_DAPP_DEFINITION_ADDRESS, // address of the dApp definition
  networkId: +process.env.ROLA_ENV, // network id of the Radix network
  expectedOrigin: process.env.ROLA_EXPECTED_ORIGIN, // origin of the client making the wallet request
});

const challengeStore = ChallengeStore();

export const createChallengeController = async (_req, res) => {
  res.send({ challenge: challengeStore.create() });
};

export const verifyController =  async (req, res) => {
  const challenges = [
    ...req.body
      .filter(r => r.challenge)
      .reduce((acc, curr) => acc.add(curr.challenge), new Set())
      .values(),
  ];

  const isChallengeValid = await Promise.all(challenges.map((challenge) =>
    challengeStore.verify(challenge)
  ));

  logger.info(isChallengeValid, 'isChallengeValid ');
  if (!isChallengeValid.every(Boolean)) return res.send({ valid: false });

  const result = await ResultAsync.combine(
    req.body.filter(r => r.challenge).map((signedChallenge) => {
      logger.info(signedChallenge, 'verifySignedChallenge ');
      return verifySignedChallenge(signedChallenge);
    })
  );

  if (result.isErr()) {
    logger.info(result, 'Error signing');
    return res.send({ valid: false });
  }

  const [personaWithProof, _accountWithProof, personaData, persona] = req.body;

  logger.info(personaWithProof.challenge, 'personaWithProof');
  logger.info(personaData, 'personaData');
  logger.info(persona, 'persona');

  // await redisClient.del(`${redisPrefix}challenge:${personaWithProof.challenge}`);

  // hash and slice due to limitation in username string length
  const username = persona.persona.label;

  // query for username
  const accountFound = await fetchUsername(pgPool, username);

  const password = secureRandom(16);

  const email = personaData.personaData[0].fields[0];

  if (!accountFound ||!accountFound.length) {
    const locale = (req.headers['Accept-Language'] || req.headers['accept-language'] || ['en-US']).split(',')[0];

    logger.info({ username, email, locale }, 'creating account');

    const response = await masto.v1.accounts.create({
      username,
      password,
      email,
      agreement: true,
      locale,
    }).catch((e) => {
      logger.error(e, 'failed to create mastodon account');
      return null;
    });

    if (!response) {
      return res.status(401).send({ valid: false, error: 'Failed to create account' });
    }

    const rolaResponse = await insertRolaInfo(pgPool, persona.persona.identityAddress, username, email, password).catch((e) => {
      logger.error(e, 'failed to create rola info');
      return null;
    });

    if (!rolaResponse) {
      const userFound = await masto.v1.accounts.lookup({ acct: username });
      await deleteMastodonAccount(userFound.data.id);

      return res.status(401).send({ valid: false, error: 'Failed to insert rola info' });
    }

    return res.status(200).send({ valid: true, email, password });
  } else {
    const rolaInfo = await getRolaInfo(pgPool, persona.persona.identityAddress);

    logger.info(rolaInfo, 'rolaInfo');

    if (!rolaInfo || !rolaInfo.length) {
      return res.status(401).send({ valid: false, error: 'No rola info found' });
    }

    return res.status(200).send({ valid: true, email: rolaInfo[0].email, password: decryptData(rolaInfo[0].password) });
  }
};
