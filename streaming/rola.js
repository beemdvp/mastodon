import {
  randomBytes,
} from 'node:crypto';

import { Rola } from '@radixdlt/rola';
import { ResultAsync } from 'neverthrow';

import { redisConfig, redisClient, pgPool } from './index.js';

const secureRandom = (byteCount) =>
  randomBytes(byteCount).toString('hex');


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

// A simple in-memory store for challenges. A database should be used in production.
export const ChallengeStore = () => {
  const create = () => {
    const challenge = secureRandom(32); // 32 random bytes as hex string
    const expires = Date.now() + 1000 * 60 * 5; // expires in 5 minutes

    console.log('creating challenge ', `${redisConfig.namespace}challenge:${challenge}`);
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
  applicationName: 'Selfi.social',
  dAppDefinitionAddress: process.env.ROLA_DAPP_DEFINITION_ADDRESS, // address of the dApp definition
  networkId: +process.env.ROLA_ENV, // network id of the Radix network
  expectedOrigin: process.env.ROLA_EXPECTED_ORIGIN, // origin of the client making the wallet request
});

const challengeStore = ChallengeStore();

export const createChallengeController = async (req, res) => {
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

  console.log('isChallengeValid ', isChallengeValid);
  if (!isChallengeValid.every(Boolean)) return res.send({ valid: false });

  const result = await ResultAsync.combine(
    req.body.filter(r => r.challenge).map((signedChallenge) => {
      console.log('verifySignedChallenge ', signedChallenge);
      return verifySignedChallenge(signedChallenge);
    })
  );

  if (result.isErr()) {
    console.log('Error signing', result);
    return res.send({ valid: false });
  }

  const [personaWithProof, accountWithProof, personaData, persona] = req.body;

  console.log('personaWithProof', personaWithProof.challenge);
  console.log('personaData', personaData);
  console.log('persona', persona);

  // await redisClient.del(`${redisPrefix}challenge:${personaWithProof.challenge}`);

  // hash and slice due to limitation in username string length
  const username = persona.persona.label;

  // query for username
  const accountFound = await fetchUsername(pgPool, username);

  const password = accountWithProof.challenge;

  const email = personaData.personaData[0].fields[0];

  if (!accountFound ||!accountFound.length) {
    return res.status(200).send({ valid: true, type: 'SIGN_UP', username, email, password, password_confirmation: password });
  } else {
    return res.status(200).send({ valid: true, type: 'SIGN_IN', email, password });
  }
};
