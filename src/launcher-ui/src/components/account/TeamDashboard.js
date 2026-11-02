import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Stack, Tabs, Tab, Divider, Box } from '@mui/material';
import { colors } from '../../theme/colors';
import TeamHeader from '../teamdashboard/TeamHeader';
import TeamMembers from '../teamdashboard/TeamMembers';
import TeamGamesTab from '../teamdashboard/TeamGamesTab';
import UnityPackagesTab from '../teamdashboard/UnityPackagesTab';

const TeamDashboard = ({ teams, onUpdateTeam }) => {
  const { teamName } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [team, setTeam] = useState(null);
  const [games, setGames] = useState([]);
  const [loadingGames, setLoadingGames] = useState(true);
  const [errorGames, setErrorGames] = useState(null);
  const [githubAvatars, setGithubAvatars] = useState([]);
  const [unityPackages, setUnityPackages] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [cdnPackages, setCdnPackages] = useState([]);
  const [loadingCdn, setLoadingCdn] = useState(false);
  const [uploadingPackages, setUploadingPackages] = useState(new Set());
  const [uploadedPackages, setUploadedPackages] = useState(() => {
    const saved = localStorage.getItem(`uploadedPackages_${teamName}`);
    return saved ? JSON.parse(saved) : [];
  });
  const [downloadingPackages, setDownloadingPackages] = useState(new Set());
  const [deletingPackages, setDeletingPackages] = useState(new Set());

  // Get current tab from URL
  const getCurrentTab = () => {
    const searchParams = new URLSearchParams(location.search);
    const tab = searchParams.get('tab');
    const unityTab = searchParams.get('unityTab');
    return {
      mainTab: tab === 'packages' ? 1 : 0,
      unityTab: unityTab === 'download' ? 1 : unityTab === 'manage' ? 2 : 0,
    };
  };

  const { mainTab, unityTab } = getCurrentTab();

  // Update URL when tabs change
  const handleTabChange = (_, newValue) => {
    const searchParams = new URLSearchParams(location.search);
    searchParams.set('tab', newValue === 1 ? 'packages' : 'games');
    navigate(`${location.pathname}?${searchParams.toString()}`, { replace: true });
  };

  const handleUnityTabChange = (_, newValue) => {
    const searchParams = new URLSearchParams(location.search);
    searchParams.set('unityTab', ['upload', 'download', 'manage'][newValue] || 'upload');
    navigate(`${location.pathname}?${searchParams.toString()}`, { replace: true });
  };

  // Function to fetch CDN packages
  const fetchCdnPackages = useCallback(async () => {
    if (!team?.team_id) return;

    setLoadingCdn(true);
    const sessionID = document.cookie.match(/sessionID=([^;]+)/)?.[1];

    if (!sessionID) {
      console.error('Missing sessionID');
      setLoadingCdn(false);
      return;
    }

    try {
      const res = await fetch('/get-all-packages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          team_id: team.team_id,
          session_id: sessionID,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Failed to fetch packages: ${errorText}`);
      }

      const data = await res.json();
      if (data && Array.isArray(data.packages)) {
        setCdnPackages(data.packages);
      } else if (Array.isArray(data)) {
        setCdnPackages(data);
      } else {
        console.error('Received invalid data format:', data);
        setCdnPackages([]);
      }
    } catch (error) {
      console.error('Error fetching packages:', error);
      setCdnPackages([]);
    } finally {
      setLoadingCdn(false);
    }
  }, [team?.team_id]);

  // Fetch CDN packages when team is loaded
  useEffect(() => {
    fetchCdnPackages();
  }, [fetchCdnPackages]);

  // Update localStorage when uploadedPackages changes
  useEffect(() => {
    if (teamName) {
      localStorage.setItem(`uploadedPackages_${teamName}`, JSON.stringify(uploadedPackages));
    }
  }, [uploadedPackages, teamName]);

  useEffect(() => {
    const foundTeam = teams.find(t => String(t.team_name) === String(teamName));
    if (foundTeam) {
      setTeam(foundTeam);
    } else {
      setTeam(null);
    }
  }, [teamName, teams]);

  useEffect(() => {
    if (!team) return;
    const fetchGames = async () => {
      try {
        const response = await fetch(
          `/get-team-games?team_name=${encodeURIComponent(team.team_name)}`
        );
        if (!response.ok) {
          throw new Error(`Failed to fetch games for team ${team.team_name}.`);
        }
        const data = await response.json();
        setGames(data);
      } catch (err) {
        setErrorGames('No Games Found!');
      } finally {
        setLoadingGames(false);
      }
    };
    fetchGames();
  }, [team]);

  useEffect(() => {
    if (!team?.github_ids || team.github_ids.length === 0) return;
    const avatars = team.github_ids.map(id => ({
      id,
      avatar_url: `https://avatars.githubusercontent.com/u/${id}?v=4`,
    }));
    setGithubAvatars(avatars);
  }, [team?.github_ids]);

  // Handler to scan for unity packages
  const handleScanUnityPackages = async () => {
    setScanning(true);
    setUnityPackages([]);
    try {
      let packages = [];
      if (window.electronAPI && window.electronAPI.getUnityPackages) {
        packages = await window.electronAPI.getUnityPackages();
      } else {
        packages = [];
      }
      setUnityPackages(packages);
    } catch (e) {
      setUnityPackages([]);
    } finally {
      setScanning(false);
    }
  };

  // Automatically scan for unity packages when Unity Packages tab is opened
  useEffect(() => {
    if (mainTab === 1 && unityPackages.length === 0 && !scanning) {
      handleScanUnityPackages();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mainTab]);

  // Upload handler
  const handleUpload = async pkg => {
    try {
      setUploadingPackages(prev => new Set([...prev, pkg.path]));
      // Get session ID from cookies
      const sessionID = document.cookie.match(/sessionID=([^;]+)/)?.[1];

      // First try to add the package entry
      const package_id = pkg.name.replace('.unitypackage', '');
      const addPackageRes = await fetch('/add-package', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          package_id,
          team_id: team.team_id,
          session_id: sessionID,
        }),
      });

      if (!addPackageRes.ok) {
        throw new Error('Failed to register package');
      }

      // If package registration succeeded, proceed with upload
      const res = await fetch('https://cdn.diabolical.services/generateUploadUrl', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(sessionID ? { sessionID } : {}),
        },
        body: JSON.stringify({
          fileExt: 'unitypackage',
          contentType: 'application/octet-stream',
          size_bytes: pkg.size,
          teamName: team.team_name,
          fileName: package_id,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to generate upload URL');
      }
      const { url } = await res.json();

      // Read the file using the electron API
      if (window.electronAPI && window.electronAPI.readFile) {
        const fileBuffer = await window.electronAPI.readFile(pkg.path);
        // Upload the file
        await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.onload = resolve;
          xhr.onerror = reject;
          xhr.open('PUT', url);
          xhr.setRequestHeader('Content-Type', 'application/octet-stream');
          xhr.send(fileBuffer);
        });

        // Add to uploaded packages list
        setUploadedPackages(prev => [...prev, pkg.path]);
        if (window.electronAPI) {
          window.electronAPI.showCustomNotification(
            'Upload Complete',
            'Your Unity package was uploaded successfully.'
          );
        }
        // Refresh CDN packages list after successful upload
        await fetchCdnPackages();
      } else {
        throw new Error('Electron API not available');
      }
    } catch (err) {
      console.error('❌ Upload failed:', err);
      if (window.electronAPI) {
        window.electronAPI.showCustomNotification(
          'Upload Failed',
          err.message === 'Quota check failed'
            ? 'You have exceeded your storage quota. Please upgrade your plan or delete some files.'
            : err.message || 'Could not upload your Unity package.'
        );
      }
    } finally {
      setUploadingPackages(prev => {
        const newSet = new Set(prev);
        newSet.delete(pkg.path);
        return newSet;
      });
    }
  };

  // Download handler
  const handleDownload = async pkg => {
    try {
      // Check if Unity Editor is running BEFORE starting the download
      const { isRunning: isUnityRunning } = await window.electronAPI.isUnityEditorRunning();
      if (!isUnityRunning) {
        if (window.electronAPI.showCustomNotification) {
          window.electronAPI.showCustomNotification(
            'Unity Editor Not Running',
            'Please open a Unity project in the Unity Editor before installing the package.'
          );
        }
        return; // DO NOT download
      }

      setDownloadingPackages(prev => new Set([...prev, pkg.id || pkg.package_id]));
      const url = pkg.package_url;
      if (!url) throw new Error('No package_url found for this package.');

      // Download the package
      const success = await window.electronAPI.downloadUnityPackage(
        url,
        `${pkg.package_id || 'UnityPackage'}`
      );

      if (success) {
        const packagePath = await window.electronAPI.getLastDownloadedPath();
        if (packagePath) {
          await window.electronAPI.installUnityPackage(packagePath);
          // Delete the package after installation
          await window.electronAPI.deleteFile(packagePath);
          if (window.electronAPI.showCustomNotification) {
            window.electronAPI.showCustomNotification(
              'Package Imported',
              'The Unity package was opened. Please complete the import in your Unity Editor.'
            );
          }
        }
      }
    } catch (err) {
      if (window.electronAPI && window.electronAPI.showCustomNotification) {
        window.electronAPI.showCustomNotification(
          'Download Failed',
          err.message || 'Could not download your Unity package.'
        );
      }
    } finally {
      setDownloadingPackages(prev => {
        const newSet = new Set(prev);
        newSet.delete(pkg.id || pkg.package_id);
        return newSet;
      });
    }
  };

  const handleDelete = async pkg => {
    const packageId = pkg.package_id;
    const sessionID = document.cookie.match(/sessionID=([^;]+)/)?.[1];
    if (!packageId || !sessionID) return;

    setDeletingPackages(prev => new Set([...prev, packageId]));
    try {
      const res = await fetch('/delete-package', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          package_id: packageId,
          team_id: team.team_id,
          session_id: sessionID,
        }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to delete package');
      }

      setUploadedPackages(prev =>
        prev.filter(path => !path.replace(/\\/g, '/').endsWith(`${packageId}.unitypackage`))
      );
      setCdnPackages(prev => prev.filter(item => item.package_id !== packageId));
      window.electronAPI?.showCustomNotification('Package Deleted', `${packageId} was removed.`);
    } catch (err) {
      console.error('Delete failed:', err);
      window.electronAPI?.showCustomNotification('Delete Failed', err.message || 'Could not delete the package.');
    } finally {
      setDeletingPackages(prev => {
        const next = new Set(prev);
        next.delete(packageId);
        return next;
      });
    }
  };

  if (!team) return null;

  return (
    <Stack
      className="h-full w-full gap-6"
      sx={{
        color: colors.text,
        background: 'none',
        padding: '24px',
        gap: 3,
        margin: '0 auto',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Stack
        direction="row"
        alignItems="flex-start"
        justifyContent="space-between"
        sx={{ width: '100%' }}
      >
        <TeamHeader team={team} githubAvatars={githubAvatars} />
      </Stack>

      {/* Tabs for Games and Unity Packages */}
      <Box
        sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 3, overflow: 'hidden' }}
      >
        <Tabs
          value={mainTab}
          onChange={handleTabChange}
          textColor="inherit"
          indicatorColor="primary"
          variant="standard"
          sx={{
            minHeight: 32,
            height: 32,
            mb: 0.5,
            '& .MuiTab-root': {
              minHeight: 32,
              height: 32,
              padding: '0 12px',
              fontSize: 13,
              fontWeight: 500,
              lineHeight: 1.2,
              gap: 0.5,
            },
            '& .MuiTab-iconWrapper': {
              fontSize: 16,
              marginRight: 4,
            },
          }}
        >
          <Tab
            label="Team Games"
            sx={{ minHeight: 32, height: 32, padding: '0 12px', fontSize: 13 }}
          />
          <Tab
            label="Unity Packages"
            sx={{ minHeight: 32, height: 32, padding: '0 12px', fontSize: 13 }}
          />
        </Tabs>
        <Divider sx={{ borderColor: colors.border, opacity: 0.5 }} />
        {mainTab === 0 ? (
          <TeamGamesTab loadingGames={loadingGames} errorGames={errorGames} games={games} />
        ) : (
          <UnityPackagesTab
            unityTab={unityTab}
            onUnityTabChange={handleUnityTabChange}
            unityPackages={unityPackages}
            scanning={scanning}
            uploadingPackages={uploadingPackages}
            uploadedPackages={uploadedPackages}
            cdnPackages={cdnPackages}
            loadingCdn={loadingCdn}
            downloadingPackages={downloadingPackages}
            onUpload={handleUpload}
            onDownload={handleDownload}
            deletingPackages={deletingPackages}
            onDelete={handleDelete}
          />
        )}
      </Box>
    </Stack>
  );
};

export default TeamDashboard;
