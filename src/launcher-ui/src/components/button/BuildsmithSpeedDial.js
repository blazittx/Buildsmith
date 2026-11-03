import React, { useState } from 'react';
import { Stack } from '@mui/material';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import SportsEsportsIcon from '@mui/icons-material/SportsEsports';
import CreateTeamDialog from '../account/dialogs/CreateTeamDialog';
import CreateGameDialog from '../account/dialogs/CreateGameDialog';
import ImageButton from './ImageButton';

const BuildsmithSpeedDial = ({ onCreateTeam, onCreateGame, teams }) => {
  const [openCreateTeamDialog, setOpenCreateTeamDialog] = useState(false);
  const [openCreateGameDialog, setOpenCreateGameDialog] = useState(false);

  return (
    <>
      <Stack direction="column" spacing="12px">
        <ImageButton
          style={{ width: '100%' }}
          text="Create Team"
          icon={GroupAddIcon}
          onClick={() => setOpenCreateTeamDialog(true)}
        />
        <ImageButton
          style={{ width: '100%' }}
          text="Create Game"
          icon={SportsEsportsIcon}
          onClick={() => setOpenCreateGameDialog(true)}
        />
      </Stack>

      <CreateTeamDialog
        open={openCreateTeamDialog}
        handleClose={() => setOpenCreateTeamDialog(false)}
        onCreate={onCreateTeam}
      />

      <CreateGameDialog
        open={openCreateGameDialog}
        handleClose={() => setOpenCreateGameDialog(false)}
        onCreate={onCreateGame}
        teams={teams}
      />
    </>
  );
};

export default BuildsmithSpeedDial;
