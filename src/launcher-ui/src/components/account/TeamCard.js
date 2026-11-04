import React, { useEffect, useMemo, useState } from 'react';
import { Avatar, AvatarGroup, Stack, Tooltip } from '@mui/material';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import OnlyImageButton from '../button/OnlyImageButton';
import InfiniteGameScroller from '../InfiniteGameScroller';
import EditTeamDialog from './dialogs/EditTeamDialog';
import InfiniteGameSkeleton from '../skeleton/InfiniteScrollerSkeleton';
import { colors } from '../../theme/colors';
import { Link } from 'react-router-dom';
import axios from 'axios';

const TeamCard = ({ team, onUpdateTeam }) => {
  const [games, setGames] = useState([]);
  const [loadingGames, setLoadingGames] = useState(true);
  const [errorGames, setErrorGames] = useState(null);
  const [githubAvatars, setGithubAvatars] = useState([]);
  const [githubUsernames, setGithubUsernames] = useState({});
  const [editOpen, setEditOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [iconVersion, setIconVersion] = useState(null);

  const fetchGames = useMemo(
    () => async () => {
      if (!team.team_name) return;
      console.log(`🎯 Fetching games for team: ${team.team_name}`);

      try {
        const response = await fetch(
          `/get-team-games?team_name=${encodeURIComponent(team.team_name)}`
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch games for team ${team.team_name}.`);
        }

        const data = await response.json();
        console.log(`✅ Games for ${team.team_name}:`, data);
        setGames(data);
      } catch (err) {
        console.error('❌ Error fetching games:', err);
        setErrorGames('No Games Found!');
      } finally {
        setLoadingGames(false);
      }
    },
    [team.team_name]
  );

  useEffect(() => {
    fetchGames();
  }, [fetchGames]);

  useEffect(() => {
    if (!team.github_ids || team.github_ids.length === 0) return;

    const avatars = team.github_ids.map(id => ({
      id,
      avatar_url: `https://avatars.githubusercontent.com/u/${id}?v=4`,
    }));

    setGithubAvatars(avatars);

    // Fetch GitHub usernames from Buildsmith API
    const fetchGitHubUsernames = async () => {
      const userPromises = team.github_ids.map(async id => {
        try {
          const response = await axios.get(
            `https://api.diabolical.studio/rest-api/users/github/${id}`
          );
          return { id, username: response.data.username };
        } catch (error) {
          console.error(`Error fetching GitHub username for ID ${id}:`, error);
          return { id, username: `Unknown-${id}` };
        }
      });

      const users = await Promise.all(userPromises);
      const usersMap = Object.fromEntries(users.map(user => [user.id, user.username]));
      setGithubUsernames(usersMap);
    };

    fetchGitHubUsernames();
  }, [team.github_ids]);

  const handleSaveTeamChanges = updatedTeam => {
    if (updatedTeam.team_icon_url !== team.team_icon_url) {
      setIconVersion(Date.now());
    }
    console.log('✅ Updating Team in UI:', updatedTeam);

    if (typeof onUpdateTeam === 'function') {
      onUpdateTeam(updatedTeam);
    }
  };

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const listStyle = {
    aspectRatio: isMobile ? false : '1',
    backgroundColor: colors.background,
    borderColor: colors.border,
  };

  return (
    <li className={'gap-3 flex flex-col justify-between border rounded-sm'} style={listStyle}>
      <Stack className={'h-full gap-3 p-3 justify-between flex-col flex'}>
        {/* Team Header */}
        <Stack
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center"
          spacing={'12px'}
        >
          <Link
            to={`/account/dashboard/teams/${team.team_name}`}
            style={{
              textDecoration: 'none',
              color: 'inherit',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              cursor: 'pointer',
            }}
            className="hover-effect"
          >
            <Avatar
              src={team.team_icon_url + (iconVersion ? `?t=${iconVersion}` : '')}
              alt={team.team_name}
              variant="square"
              sx={{ width: 32, height: 32, '& img': { objectFit: 'scale-down' } }}
            />
            <span style={{ lineHeight: 1 }}>{team.team_name}</span>
          </Link>
          <OnlyImageButton icon={SettingsRoundedIcon} onClick={() => setEditOpen(true)} />
        </Stack>

        {/* Infinite Scrolling Games */}
        {loadingGames ? (
          <InfiniteGameSkeleton />
        ) : errorGames ? (
          <p style={{ color: 'red', textAlign: 'center' }}>{errorGames}</p>
        ) : (
          <InfiniteGameScroller games={games} />
        )}

        {/* Team Members - GitHub Profile Pictures */}
        <Stack flexDirection={'row-reverse'}>
          <AvatarGroup
            max={4}
            sx={{
              '& .MuiAvatar-root': {
                width: 32,
                height: 32,
                borderColor: colors.border,
                transition: 'transform 0.2s ease-in-out',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  zIndex: 2,
                },
              },
              '& .MuiAvatarGroup-avatar': {
                backgroundColor: colors.background,
                color: colors.text,
                fontSize: '14px',
              },
            }}
          >
            {githubAvatars.map(member => (
              <Tooltip
                key={member.id}
                title={githubUsernames[member.id] || `GitHub User ${member.id}`}
                arrow
                placement="top"
              >
                <Avatar
                  alt={githubUsernames[member.id] || `GitHub User ${member.id}`}
                  src={member.avatar_url}
                />
              </Tooltip>
            ))}
          </AvatarGroup>
        </Stack>
      </Stack>

      {/* Edit Team Dialog */}
      <EditTeamDialog
        open={editOpen}
        handleClose={() => setEditOpen(false)}
        team={team}
        onSave={handleSaveTeamChanges}
      />
    </li>
  );
};

export default TeamCard;
