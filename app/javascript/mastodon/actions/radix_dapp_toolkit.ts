import type { RadixDappToolkit } from '@radixdlt/radix-dapp-toolkit';

export const SET_RADIX_DAPP_TOOLKIT = 'SET_RADIX_DAPP_TOOLKIT';

export const setRadixDappToolkit = (value: typeof RadixDappToolkit) => {
  return {
    type: SET_RADIX_DAPP_TOOLKIT,
    value,
  };
};
