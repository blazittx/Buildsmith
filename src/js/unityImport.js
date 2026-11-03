const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const SCRIPT_NAME = 'BuildsmithPackageImport.cs';
const SCRIPT_ASSET = `Assets/Editor/${SCRIPT_NAME}`;

function projectPathFromCommandLine(commandLine) {
  if (!commandLine) return null;
  const match = commandLine.match(/-projectpath\s+(?:"([^"]+)"|(\S+))/i);
  return match ? match[1] || match[2] : null;
}

function folderName(projectPath) {
  const parts = String(projectPath).split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] || projectPath;
}

function projectsFromProcessList(entries) {
  const projects = [];
  const seen = new Set();
  for (const entry of entries) {
    const projectPath = projectPathFromCommandLine(entry.CommandLine || entry.commandLine || '');
    if (!projectPath || seen.has(projectPath)) continue;
    seen.add(projectPath);
    projects.push({
      pid: Number(entry.ProcessId || entry.pid) || null,
      projectPath,
      name: folderName(projectPath),
    });
  }
  return projects;
}

function importScript(packagePath) {
  const literal = String(packagePath).replace(/"/g, '""');
  return `using System.IO;
using UnityEditor;

[InitializeOnLoad]
internal static class BuildsmithPackageImport
{
    const string PackagePath = @"${literal}";
    const string ScriptPath = "${SCRIPT_ASSET}";

    static BuildsmithPackageImport()
    {
        EditorApplication.delayCall += Start;
    }

    static void Start()
    {
        AssetDatabase.importPackageCompleted += OnDone;
        AssetDatabase.importPackageCancelled += OnDone;
        AssetDatabase.importPackageFailed += OnFailed;
        AssetDatabase.ImportPackage(PackagePath, true);
    }

    static void OnDone(string _)
    {
        Cleanup();
    }

    static void OnFailed(string _, string __)
    {
        Cleanup();
    }

    static void Cleanup()
    {
        AssetDatabase.importPackageCompleted -= OnDone;
        AssetDatabase.importPackageCancelled -= OnDone;
        AssetDatabase.importPackageFailed -= OnFailed;
        if (File.Exists(PackagePath)) File.Delete(PackagePath);
        AssetDatabase.DeleteAsset(ScriptPath);
    }
}
`;
}

function runPowerShell(command) {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', command],
      { windowsHide: true, maxBuffer: 4 * 1024 * 1024 },
      (error, stdout) => {
        if (error) reject(error);
        else resolve(stdout);
      }
    );
  });
}

async function listOpenUnityProjects() {
  const stdout = await runPowerShell(
    "Get-CimInstance Win32_Process -Filter \"Name = 'Unity.exe'\" | Select-Object ProcessId, CommandLine | ConvertTo-Json -Compress"
  );
  const trimmed = String(stdout || '').trim();
  if (!trimmed) return [];
  const parsed = JSON.parse(trimmed);
  return projectsFromProcessList(Array.isArray(parsed) ? parsed : [parsed]);
}

async function queueImport(projectPath, packagePath) {
  const assets = path.join(projectPath, 'Assets');
  try {
    await fs.promises.access(assets);
  } catch {
    throw new Error(`Unity project has no Assets folder: ${projectPath}`);
  }
  const editorDir = path.join(assets, 'Editor');
  await fs.promises.mkdir(editorDir, { recursive: true });
  await fs.promises.writeFile(path.join(editorDir, SCRIPT_NAME), importScript(packagePath), 'utf8');
}

async function importIntoOpenUnity(packagePath, chooseProject) {
  const projects = await listOpenUnityProjects();
  if (!projects.length) {
    throw new Error('Open a Unity project first. The package is sent to the editor that is already running.');
  }
  const project = projects.length === 1 ? projects[0] : await chooseProject(projects);
  if (!project) {
    await fs.promises.unlink(packagePath).catch(() => {});
    throw new Error('Import cancelled');
  }
  await queueImport(project.projectPath, packagePath);
  return { name: project.name };
}

module.exports = {
  projectPathFromCommandLine,
  projectsFromProcessList,
  importScript,
  importIntoOpenUnity,
};
