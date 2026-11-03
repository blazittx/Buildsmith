import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import VerticalFlex from './layout/VerticalFlex';
import OpenExternalLink from './link/OpenExternalLink';
import { colors } from '../theme/colors';
import { IconButton, styled, Zoom } from '@mui/material';
import SportsEsportsRoundedIcon from '@mui/icons-material/SportsEsportsRounded';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import InfoRoundedIcon from '@mui/icons-material/InfoRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';

// Create a styled IconButton for our nav items
const StyledNavButton = styled(IconButton, {
  shouldForwardProp: prop => prop !== 'isActive',
})(({ theme, isActive }) => ({
  padding: '12px',
  borderRadius: '4px',
  border: `1px solid ${colors.border}`,
  backgroundColor: isActive ? 'rgba(0,0,0,0.6)' : 'transparent',
  backdropFilter: 'blur(8px)',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  '&:hover': {
    backgroundColor: isActive ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.2)',
  },
  '&:active': {
    opacity: 0.8,
  },
  '&:focus': {
    outline: 'none',
  },
  '&.MuiIconButton-root': {
    '&:focus': {
      outline: 'none',
    },
    '&:hover': {
      outline: 'none',
    },
  },
}));

const NavBar = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  //Where we declare routes
  const menuItems = [
    { to: '/account', icon: PersonRoundedIcon, alt: 'Account' },
    { to: '/library', icon: SportsEsportsRoundedIcon, alt: 'Library' },
    { to: '/', icon: HomeRoundedIcon, alt: 'Home' },
    { to: '/settings', icon: SettingsRoundedIcon, alt: 'Settings' },
    { to: '/changelog', icon: InfoRoundedIcon, alt: 'Changelog' },
  ];

  return (
    <VerticalFlex
      className={isMobile ? 'flex-row justify-center items-center gap-2' : ''}
      style={isMobile ? { height: 'fit-content' } : {}}
    >
      {!isMobile && (
        <Zoom in={true} timeout={200}>
          <div>
            <OpenExternalLink url="https://buildsmith.app">
              <img
                className="w-full aspect-square cursor-pointer hover:scale-105 transition-transform"
                src="/android-chrome-192x192.png"
                alt="Icon"
                draggable="false"
              />
            </OpenExternalLink>
          </div>
        </Zoom>
      )}

      <ul
        className={`flex ${isMobile ? 'flex-row' : 'flex-col'} align-center m-0 p-0 gap-3 w-fit `}
      >
        {menuItems.map((item, index) => (
          <Zoom
            key={item.to}
            in={true}
            style={{
              transitionDelay: `${index * 100}ms`,
            }}
          >
            <li>
              <NavLink
                to={item.to}
                style={({ isActive }) => ({
                  display: 'block',
                })}
              >
                {({ isActive }) => (
                  <StyledNavButton isActive={isActive}>
                    <item.icon
                      sx={{ color: isActive ? '#ffffff' : '#4b4b4b', fontSize: isMobile ? 24 : 28 }}
                    />
                  </StyledNavButton>
                )}
              </NavLink>
            </li>
          </Zoom>
        ))}
      </ul>
    </VerticalFlex>
  );
};

export default NavBar;
