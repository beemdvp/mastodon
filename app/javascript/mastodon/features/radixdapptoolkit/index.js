import { RadixDappToolkit, RadixNetwork , DataRequestBuilder } from '@radixdlt/radix-dapp-toolkit';

const rdt = RadixDappToolkit({
  dAppDefinitionAddress:
  'account_tdx_2_12yf9gd53yfep7a669fv2t3wm7nz9zeezwd04n02a433ker8vza6rhe',
  networkId: RadixNetwork.Stokenet,
  applicationName: 'Radix Web3 dApp',
  applicationVersion: '1.0.0',
});


rdt.walletApi.setRequestData(
  DataRequestBuilder.accounts().exactly(1).withProof(),
  DataRequestBuilder.persona().withProof(),
  DataRequestBuilder.personaData().emailAddresses(),
);

const getChallenge = () =>
  fetch('http://localhost:4000/create-challenge')
    .then((res) => res.json())
    .then((res) => res.challenge);

rdt.walletApi.provideChallengeGenerator(getChallenge);

rdt.walletApi.dataRequestControl(async ({ proofs, personaData, persona }) => {
  const { valid } = await fetch('http://localhost:4000/verify', {
    method: 'POST',
    body: JSON.stringify([...proofs, { personaData }, { persona }]),
    headers: { 'content-type': 'application/json' },
  }).then((res) => res.json());

  console.log('account verified ', valid);

  if (!valid) {
    this.rdt.disconnect();
  }
});
