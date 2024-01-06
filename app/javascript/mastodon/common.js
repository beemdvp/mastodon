import { DataRequestBuilder, RadixDappToolkit, RadixNetwork, OneTimeDataRequestBuilder } from '@radixdlt/radix-dapp-toolkit';
import Rails from '@rails/ujs';
import 'font-awesome/css/font-awesome.css';

export function start() {
  require.context('../images/', true);

  try {
    const rdt = RadixDappToolkit({
      dAppDefinitionAddress:
      'account_tdx_e_128uml7z6mqqqtm035t83alawc3jkvap9sxavecs35ud3ct20jxxuhl',
      networkId: RadixNetwork.Stokenet,
      applicationName: 'Radix Web3 dApp',
      applicationVersion: '1.0.0',
    });

    rdt.walletApi.setRequestData(
      DataRequestBuilder.accounts().exactly(1),
      DataRequestBuilder.personaData().emailAddresses(),
    );

    rdt.walletApi.sendOneTimeRequest(
      OneTimeDataRequestBuilder.accounts().exactly(1),
      OneTimeDataRequestBuilder.personaData().emailAddresses(),
    );

    Rails.start();
  } catch (e) {
    // If called twice
  }
}
