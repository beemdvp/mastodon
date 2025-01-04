import { RadixDappToolkit, DataRequestBuilder } from '@radixdlt/radix-dapp-toolkit';
import Rails from '@rails/ujs';

const url = window.location.origin.includes('localhost') ? 'http://localhost:4000' : window.ROLA_API_ENDPOINT;

const color = '#292938';

export function start() {
  require.context('../images/', true, /\.(jpg|png|svg)$/);
  const rdt = RadixDappToolkit({
    dAppDefinitionAddress: window.ROLA_DAPP_DEFINITION_ADDRESS, // address of the dApp definition,
    networkId: window.ROLA_ENV,
    applicationName: window.ROLA_APPLICATION_NAME,
    applicationVersion: window.ROLA_APPLICATION_VERSION,
  });

  if (window.location.pathname === '/auth/sign_in') {
    rdt.disconnect();
  }

  rdt.walletApi.setRequestData(
    DataRequestBuilder.accounts().exactly(1).withProof(),
    DataRequestBuilder.persona().withProof(),
    DataRequestBuilder.personaData().emailAddresses(),
  );

  const getChallenge = () =>
    fetch(`${url}/create-challenge`)
      .then((res) => res.json())
      .then((res) => res.challenge);

  rdt.walletApi.provideChallengeGenerator(getChallenge);

  rdt.walletApi.dataRequestControl(async ({ proofs, personaData, persona }) => {
    const { valid, ...userSignup } = await fetch(`${url}/verify`, {
      method: 'POST',
      body: JSON.stringify([...proofs, { personaData }, { persona }]),
      headers: { 'content-type': 'application/json' },
    }).then((res) => res.json());

    if (!valid) {
      rdt.disconnect();
    } else {
      const emailInput = document.getElementById('user_email');
      emailInput.style.setProperty('color', color);
      emailInput.value = userSignup.email;
      const passwordInput = document.getElementById('user_password');
      passwordInput.style.setProperty('color', color);
      passwordInput.value = userSignup.password;
      document.querySelector('button[name=button]').click();
    }
  });

  window.rdt = rdt;

  try {
    Rails.start();
  } catch {
    // If called twice
  }
}
