import { Button, Chip, CircularProgress, Stack, TextField, Typography } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import UploadIcon from '@mui/icons-material/Upload';
import { colors } from '../../../../theme/colors';
import { fieldSx, ghostButtonSx, isVersion } from './formStyles';

const sources = [
  { id: 0, title: 'Deploy from GitHub', body: 'Buildsmith builds from a repository you authorize.' },
  { id: 1, title: 'Upload a ZIP', body: 'Ship a Windows build you already packaged.' },
];

export default function BuildStep({
  activeTab,
  onTabChange,
  connectedAccounts,
  searchQuery,
  setSearchQuery,
  loadRepositories,
  loadingRepos,
  filteredRepos,
  selectedRepo,
  setSelectedRepo,
  ownerAvatars,
  onAuthorize,
  gameVersion,
  setGameVersion,
  gameFile,
  gameFileName,
  onFile,
}) {
  const versionOk = isVersion(gameVersion);

  return (
    <Stack gap={2}>
      <Stack direction="row" gap={1.5}>
        {sources.map(option => {
          const selected = activeTab === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onTabChange(option.id)}
              style={{
                flex: 1,
                textAlign: 'left',
                padding: '14px 16px',
                borderRadius: 4,
                cursor: 'pointer',
                background: selected ? colors.primary + '18' : 'transparent',
                border: `1px solid ${selected ? colors.primary : colors.border}`,
                color: colors.text,
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 4 }}>{option.title}</div>
              <div style={{ color: '#9a9a9a', fontSize: 13 }}>{option.body}</div>
            </button>
          );
        })}
      </Stack>

      {activeTab === 0 ? (
        <>
          {connectedAccounts.length > 0 && (
            <Stack spacing={1.5} sx={{ borderRadius: '4px', padding: '14px 16px', border: '1px solid ' + colors.border }}>
              <Typography sx={{ color: colors.text, fontSize: 13, fontWeight: 600 }}>Connected GitHub accounts</Typography>
              <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
                {connectedAccounts.map(account => (
                  <Stack key={account.id} direction="row" alignItems="center" spacing={1} sx={{ padding: '6px 10px' }}>
                    <img src={account.avatarUrl} alt="" style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover' }} />
                    <Typography sx={{ color: colors.text, fontSize: 13 }}>{account.name}</Typography>
                    <Chip
                      label={account.type}
                      size="small"
                      sx={{ backgroundColor: 'rgba(0, 188, 212, 0.1)', color: '#00bcd4', height: 20, fontSize: 11, borderRadius: '4px' }}
                    />
                  </Stack>
                ))}
              </Stack>
            </Stack>
          )}

          <Stack direction="row" gap={1} alignItems="center">
            <TextField
              placeholder="Search repositories..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              sx={{ ...fieldSx, flex: 1 }}
            />
            <Button
              onClick={loadRepositories}
              disabled={loadingRepos}
              startIcon={loadingRepos ? <CircularProgress size={14} /> : <RefreshIcon />}
              sx={ghostButtonSx}
            >
              Reload
            </Button>
          </Stack>

          <Stack
            sx={{
              borderRadius: '4px',
              border: '1px solid ' + colors.border,
              height: 240,
              overflowY: 'auto',
              padding: '8px',
              gap: 0.5,
            }}
          >
            {loadingRepos ? (
              <Stack alignItems="center" justifyContent="center" sx={{ height: '100%', gap: 1 }}>
                <CircularProgress size={20} />
                <Typography sx={{ color: colors.text, fontSize: 14 }}>Loading repositories...</Typography>
              </Stack>
            ) : filteredRepos.length === 0 ? (
              <Stack alignItems="center" justifyContent="center" sx={{ height: '100%' }}>
                <Typography sx={{ color: '#888', fontSize: 14 }}>
                  {searchQuery ? 'No repositories found' : 'No repositories available'}
                </Typography>
              </Stack>
            ) : (
              filteredRepos.map(repo => {
                const selected = selectedRepo === repo.full_name;
                return (
                  <Stack
                    key={repo.id}
                    direction="row"
                    alignItems="center"
                    spacing={1}
                    onClick={() => setSelectedRepo(repo.full_name)}
                    sx={{
                      padding: '10px 12px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      background: selected ? colors.primary + '18' : 'transparent',
                      border: `1px solid ${selected ? colors.primary : 'transparent'}`,
                      '&:hover': { background: colors.primary + '10' },
                    }}
                  >
                    <img
                      src={ownerAvatars[repo.owner.login] || '/github.png'}
                      alt=""
                      style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover' }}
                    />
                    <Typography sx={{ color: colors.text, flex: 1, fontSize: 14 }}>{repo.full_name}</Typography>
                    <Chip
                      label={repo.private ? 'Private' : 'Public'}
                      size="small"
                      sx={{
                        backgroundColor: repo.private ? 'rgba(255, 64, 129, 0.1)' : 'rgba(0, 230, 118, 0.1)',
                        color: repo.private ? '#ff4081' : '#00e676',
                        height: 20,
                        fontSize: 11,
                        borderRadius: '4px',
                      }}
                    />
                  </Stack>
                );
              })
            )}
          </Stack>

          <Button
            variant="outlined"
            onClick={onAuthorize}
            startIcon={<InfoOutlinedIcon />}
            sx={{ ...ghostButtonSx, alignSelf: 'flex-start' }}
          >
            Can't find your repo? Authorize more repositories
          </Button>
        </>
      ) : (
        <Stack gap={2}>
          <TextField
            label="Version"
            value={gameVersion}
            onChange={e => setGameVersion(e.target.value)}
            error={!versionOk}
            helperText={versionOk ? 'Use major.minor.patch, for example 1.0.0' : 'Version must look like 1.0.0'}
            sx={fieldSx}
          />
          <Stack
            onDragOver={e => {
              e.preventDefault();
              e.currentTarget.style.borderColor = colors.primary;
            }}
            onDragLeave={e => {
              e.preventDefault();
              e.currentTarget.style.borderColor = colors.border;
            }}
            onDrop={e => {
              e.preventDefault();
              e.currentTarget.style.borderColor = colors.border;
              onFile(e.dataTransfer.files[0]);
            }}
            onClick={() => document.getElementById('game-file-upload')?.click()}
            sx={{
              height: 180,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px',
              border: `1px dashed ${gameFile ? colors.primary : colors.border}`,
              cursor: 'pointer',
              gap: 0.5,
            }}
          >
            <input id="game-file-upload" hidden type="file" accept=".zip" onChange={e => onFile(e.target.files[0])} />
            <UploadIcon style={{ color: gameFile ? colors.primary : '#888' }} />
            <Typography sx={{ color: colors.text }}>{gameFile ? gameFileName : 'Drop a ZIP here, or click to browse'}</Typography>
            <Typography sx={{ color: '#888', fontSize: 12 }}>
              {gameFile ? 'Click or drop a file to replace it' : 'Windows standalone ZIP'}
            </Typography>
          </Stack>
        </Stack>
      )}
    </Stack>
  );
}
