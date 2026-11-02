import { FormControl, InputLabel, MenuItem, Select, Stack, TextField } from '@mui/material';
import { fieldSx, menuProps, PreviewCard, selectSx } from './formStyles';

export default function DetailsStep({
  gameName,
  setGameName,
  gameDescription,
  setGameDescription,
  gameId,
  setGameId,
  gameIdError,
  setGameIdError,
  gameIdValid,
  teams,
  selectedTeam,
  onTeamChange,
  gameStatus,
  setGameStatus,
  previewGame,
}) {
  return (
    <Stack direction="row" gap={3} alignItems="flex-start">
      <Stack gap={2} sx={{ flex: 1 }}>
        <TextField label="Game name" value={gameName} onChange={e => setGameName(e.target.value)} fullWidth sx={fieldSx} />
        <TextField
          label="Description"
          value={gameDescription}
          onChange={e => setGameDescription(e.target.value)}
          fullWidth
          multiline
          minRows={3}
          sx={fieldSx}
        />
        <TextField
          label="Game ID"
          value={gameId}
          onChange={e => {
            setGameId(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''));
            setGameIdError(false);
          }}
          error={gameIdError || (gameId.length > 0 && !gameIdValid)}
          helperText="Lowercase letters and numbers, up to 20 characters."
          fullWidth
          sx={fieldSx}
          inputProps={{ maxLength: 20 }}
        />
        <Stack direction="row" gap={2}>
          <FormControl fullWidth>
            <InputLabel id="team-select-label" sx={{ color: '#888' }}>
              Team
            </InputLabel>
            <Select
              labelId="team-select-label"
              value={selectedTeam}
              label="Team"
              onChange={onTeamChange}
              sx={selectSx}
              MenuProps={menuProps}
            >
              {(teams || []).map(team => (
                <MenuItem key={team.team_id || team.team_name} value={team.team_name}>
                  {team.team_name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth>
            <InputLabel id="status-select-label" sx={{ color: '#888' }}>
              Visibility
            </InputLabel>
            <Select
              labelId="status-select-label"
              value={gameStatus}
              label="Visibility"
              onChange={e => setGameStatus(e.target.value)}
              sx={selectSx}
              MenuProps={menuProps}
            >
              <MenuItem value="public">Public</MenuItem>
              <MenuItem value="private">Private</MenuItem>
              <MenuItem value="archived">Archived</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </Stack>
      <PreviewCard game={previewGame} />
    </Stack>
  );
}
