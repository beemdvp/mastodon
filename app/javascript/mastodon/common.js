import { RadixDappToolkit, RadixNetwork , DataRequestBuilder } from '@radixdlt/radix-dapp-toolkit';
import Rails from '@rails/ujs';

import { logOut } from './utils/log_out';


export function start() {
  require.context('../images/', true, /\.(jpg|png|svg)$/);

  const rdt = RadixDappToolkit({
    dAppDefinitionAddress:
    'account_tdx_2_12yf9gd53yfep7a669fv2t3wm7nz9zeezwd04n02a433ker8vza6rhe',
    networkId: RadixNetwork.Stokenet,
    applicationName: 'Radix Web3 dApp',
    applicationVersion: '1.0.0',
    onDisconnect: () => {
      logOut();
    },
  });


  rdt.walletApi.setRequestData(
    DataRequestBuilder.accounts().exactly(1).withProof(),
    DataRequestBuilder.persona().withProof(),
    DataRequestBuilder.personaData().emailAddresses(),
  );

  const getChallenge = () =>
    fetch('/create-challenge')
      .then((res) => res.json())
      .then((res) => res.challenge);

  rdt.walletApi.provideChallengeGenerator(getChallenge);

  rdt.walletApi.dataRequestControl(async ({ proofs, personaData, persona }) => {
    const { valid, ...userSignup } = await fetch('http://localhost:4000/verify', {
      method: 'POST',
      body: JSON.stringify([...proofs, { personaData }, { persona }]),
      headers: { 'content-type': 'application/json' },
    }).then((res) => res.json());

    if (!valid) {
      throw new Error('User account verification failed');
    } else {
      if (userSignup.type === 'SIGN_UP') {
        document.getElementById('user_account_attributes_username').value = userSignup.username;
        document.getElementById('user_email').value = userSignup.email;
        document.getElementById('user_password').value = userSignup.password;
        document.getElementById('user_password_confirmation').value = userSignup.password_confirmation;
        document.getElementById('user_agreement').click();
        document.querySelector('button[name=button]').click();
      } else if (userSignup.type === 'SIGN_IN') {
        document.getElementById('user_email').value = userSignup.email;
        document.getElementById('user_password').value = userSignup.password;
        document.querySelector('button[name=button]').click();
      }
    }});

  window.rdt = rdt;

  try {
    Rails.start();
  } catch {
    // If called twice
  }
}
