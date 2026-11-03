// AccountDashboard.js
import React, { useCallback, useEffect, useState } from 'react';
import { Link, Route, Routes, Navigate } from 'react-router-dom';
import Cookies from 'js-cookie';
import { Avatar, Stack } from '@mui/material';
import Teams from './Teams';
import Games from './Games';
import AccountName from './AccountName';
import Grid from '../Grid';
import Divider from '../Divider';
import ImageButton from '../button/ImageButton';
import BuildsmithSpeedDial from '../button/BuildsmithSpeedDial';
import GroupsIcon from '@mui/icons-material/Groups';
import SportsEsportsRoundedIcon from '@mui/icons-material/SportsEsportsRounded';
import { colors } from '../../theme/colors';
import AccountSettings, { services, useConnectedProviders } from './AccountSettings';
import StorageBreakdown from './StorageBreakdown';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import TeamDashboard from './TeamDashboard';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';

export default function AccountDashboard({ username }) {
  const [teams, setTeams] = useState([]);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [errorTeams, setErrorTeams] = useState(null);
  const githubId = Cookies.get('githubID');
  const githubAvatar = githubId ? `https://avatars.githubusercontent.com/u/${githubId}?v=4` : null;
  const { connectedProviders, loading } = useConnectedProviders();
  const connectedServices = services.filter(s => connectedProviders.includes(s.name));

  const fetchTeams = useCallback(async () => {
    const sessionID = Cookies.get('sessionID');
    if (!sessionID) {
      setErrorTeams('No session ID found.');
      setLoadingTeams(false);
      return;
    }
    try {
      const response = await fetch('/get-user-teams', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          sessionID: sessionID,
        },
      });
      if (!response.ok) {
        throw new Error('Failed to fetch teams.');
      }
      const data = await response.json();
      setTeams(data);
    } catch (err) {
      setErrorTeams('Failed to load teams.');
    } finally {
      setLoadingTeams(false);
    }
  }, []);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  const handleUpdateTeam = updatedTeam => {
    setTeams(prev =>
      prev.map(team => (team.team_id === updatedTeam.team_id ? { ...team, ...updatedTeam } : team))
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div
        className="flex justify-between align-center backdrop-blur p-3"
        style={{
          backgroundColor: colors.transparent,
          borderBottom: '1px solid' + colors.border,
        }}
      >
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          sx={{ width: '100%' }}
        >
          {/* Left: Avatar + Username */}
          <Stack direction="row" spacing="12px" alignItems="center">
            <Avatar
              alt="GitHub User"
              src={githubAvatar || '/static/images/avatar/1.jpg'}
              sx={{ width: 32, height: 32, outline: '1px solid' + colors.border }}
            />
            <AccountName username={username} />
          </Stack>
          {/* Right: Chips */}
          <Stack direction="row" spacing={1}>
            {loading
              ? Array.from({ length: 3 }).map((_, idx) => (
                  <Skeleton
                    key={idx}
                    width={70}
                    height="{100%}"
                    sx={{
                      borderRadius: '4px',
                      marginLeft: idx === 0 ? 0 : 1,
                    }}
                  />
                ))
              : connectedServices.map(service => (
                  <Chip
                    key={service.name}
                    label={service.name}
                    avatar={
                      <img
                        src={service.icon}
                        alt={service.name}
                        style={{ width: 12, height: 12, filter: 'invert(1)', margin: 0 }}
                      />
                    }
                    size="small"
                    sx={{
                      background: '#18181b',
                      color: '#fff',
                      border: `1px solid ${colors.border}`,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '12px',
                      borderRadius: '4px',
                      '& .MuiChip-label': {
                        padding: 0,
                      },
                    }}
                  />
                ))}
          </Stack>
        </Stack>
      </div>
      <div className="w-full h-full flex overflow-hidden">
        <ul className="flex flex-col gap-3 h-full w-1/5 p-3 m-0 justify-between">
          <Stack direction="column" spacing="12px">
            <Link to="/account/dashboard/settings">
              <ImageButton style={{ width: '100%' }} text="Account" icon={PersonRoundedIcon} />
            </Link>
            <Link to="/account/dashboard/teams">
              <ImageButton style={{ width: '100%' }} text="Teams" icon={GroupsIcon} />
            </Link>
            <Link to="/account/dashboard/games">
              <ImageButton style={{ width: '100%' }} text="Games" icon={SportsEsportsRoundedIcon} />
            </Link>
          </Stack>
          <BuildsmithSpeedDial onCreateTeam={fetchTeams} teams={teams} />
        </ul>
        <Divider vertical />
        <div className="flex flex-col gap-3 size-full mt-0" style={{ overflow: 'hidden' }}>
          <Routes>
            <Route index element={<Navigate to="teams" replace />} />
            <Route
              path="settings/storage"
              element={
                <Grid>
                  <StorageBreakdown />
                </Grid>
              }
            />
            <Route
              path="settings"
              element={
                <Grid>
                  <AccountSettings username={username} />
                </Grid>
              }
            />
            <Route
              path="games"
              element={
                <Grid>
                  <Games teams={teams} />
                </Grid>
              }
            />
            <Route path="teams">
              <Route
                index
                element={
                  <Grid>
                    <Teams
                      teams={teams}
                      loading={loadingTeams}
                      error={errorTeams}
                      onUpdateTeam={handleUpdateTeam}
                    />
                  </Grid>
                }
              />
              <Route
                path=":teamName"
                element={
                  <Grid>
                    <TeamDashboard teams={teams} onUpdateTeam={handleUpdateTeam} />
                  </Grid>
                }
              />
            </Route>
          </Routes>
        </div>
      </div>
    </div>
  );
}
