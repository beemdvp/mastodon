import { Map as ImmutableMap } from 'immutable';

import { SET_RADIX_DAPP_TOOLKIT } from 'mastodon/actions/radix_dapp_toolkit';
// import { STORE_HYDRATE } from 'mastodon/actions/store';
// import { layoutFromWindow } from 'mastodon/is_mobile';

const initialState = ImmutableMap({
  radix: null
});

export default function radix_dapp_toolkit(state = initialState, action) {
  switch(action.type) {
  case SET_RADIX_DAPP_TOOLKIT:
    return state.set('rdt', state.get('rdt'));
  default:
    return state;
  }
}

