import React, { useState } from 'react';
import OnlyImageButton from '../button/OnlyImageButton';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import { Stack } from '@mui/material';
import EditGameDialog from './dialogs/EditGameDialog';
import GameButton from '../button/GameButton';

const EditGameCard = ({ game, isInstalled, onUpdateGame }) => {
  const [editOpen, setEditOpen] = useState(false);

  const handleSaveGameChanges = updatedGame => {
    console.log('✅ Updating Game in UI:', updatedGame);

    if (typeof onUpdateGame === 'function') {
      onUpdateGame(updatedGame);
    }
  };

  return (
    <Stack
      className={'game-banner flex flex-col justify-between items-end p-3 w-auto aspect-63/88'}
      style={{
        backgroundImage: `url('${game.background_image_url}')`,
      }}
      onContextMenu={e => {
        e.preventDefault();
        window.electronAPI.showContextMenu(game.game_id, { x: e.pageX, y: e.pageY });
      }}
    >
      <OnlyImageButton
        icon={SettingsRoundedIcon}
        style={{ padding: '6px' }}
        onClick={() => setEditOpen(true)}
      />

      <Stack className={'flex flex-col gap-3 w-full'}>
        <Stack className="game-details">
          <h3>{game.game_name.toUpperCase()}</h3>
          <p>
            {game.description?.length > 80
              ? `${game.description.slice(0, 80).trimEnd()}…`
              : game.description}
          </p>
        </Stack>
        <Stack className={'flex gap-3'}>
          <GameButton isEditing gameVersion={'placeholder button'} onClick={() => {}} />

          {/* <HoverMenu
                    actions={[{
                        label: "Uninstall", icon: "MenuIcons/Trash.png", onClick: () => console.log("Uninstall clicked")
                    },]}
                />*/}
        </Stack>
      </Stack>

      <EditGameDialog
        open={editOpen}
        handleClose={() => setEditOpen(false)}
        game={game}
        onSave={handleSaveGameChanges}
      />
    </Stack>
  );
};

export default EditGameCard;
