const { projectPathFromCommandLine, projectsFromProcessList, importScript } = require('../src/js/unityImport');

test('reads a quoted Unity project path from the editor command line', () => {
  const command =
    '"C:\\Program Files\\Unity\\Hub\\Editor\\2022.3.10f1\\Editor\\Unity.exe" -projectpath "D:\\Games\\My Project" -useHub';
  expect(projectPathFromCommandLine(command)).toBe('D:\\Games\\My Project');
});

test('reads an unquoted project path', () => {
  expect(projectPathFromCommandLine('Unity.exe -projectPath C:\\Games\\Demo -useHub')).toBe('C:\\Games\\Demo');
});

test('ignores a Unity process that has no open project', () => {
  const projects = projectsFromProcessList([
    { ProcessId: 10, CommandLine: 'Unity.exe -batchmode' },
    {
      ProcessId: 11,
      CommandLine: 'Unity.exe -projectpath "D:\\Games\\Demo"',
    },
  ]);
  expect(projects).toEqual([{ pid: 11, projectPath: 'D:\\Games\\Demo', name: 'Demo' }]);
});

test('the import script targets one package and removes itself afterwards', () => {
  const script = importScript('C:\\temp\\pack "1".unitypackage');
  expect(script).toContain('@"C:\\temp\\pack ""1"".unitypackage"');
  expect(script).toContain('AssetDatabase.ImportPackage(PackagePath, true)');
  expect(script).toContain('AssetDatabase.DeleteAsset(ScriptPath)');
});
