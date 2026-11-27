
import '../../global/actions/initial';

import { memo } from '../../lib/teact/teact';

import { IS_TAURI } from '../../util/browser/globalEnvironment';
import { IS_MAC_OS } from '../../util/browser/windowEnvironment';

import Transition from '../ui/Transition';
import AuthPhoneNumber from './AuthPhoneNumber';

import './Auth.scss';

const Auth = () => {
  return (
    <Transition
      activeKey={0}
      name="fade"
      className="Auth"
      data-tauri-drag-region={IS_TAURI && IS_MAC_OS ? true : undefined}
    >
      <AuthPhoneNumber />
    </Transition>
  );
};

export default memo(Auth);
