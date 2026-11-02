import React from 'react';
import Cookies from 'js-cookie';
import { colors } from '../../theme/colors';

const LogoutButton = ({ children, style = {} }) => {
  return (
    <button
      className="game-button shimmer-button rounded-sm cursor-pointer w-fit p-3 text-sm"
      onClick={() => {
        const sessionID = Cookies.get('sessionID');
        const done = () => {
          Cookies.remove('username');
          Cookies.remove('sessionID');
          Cookies.remove('githubID');
          window.location.reload();
        };
        if (!sessionID) {
          done();
          return;
        }
        fetch('/delete-session', { method: 'DELETE', headers: { sessionID } }).finally(done);
      }}
      style={{
        color: colors.text,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...style,
      }}
    >
      {children || 'Logout'}
    </button>
  );
};

export default LogoutButton;
