const { appBuildScript, steamcmdArgs } = require('../src/js/steamPipe');

test('app build script maps the content root into the depot and sets a beta branch live', () => {
  const script = appBuildScript({
    appId: '1000',
    depotId: '1001',
    description: '1.2.3',
    contentRoot: 'C:\\builds\\game',
    buildOutput: 'C:\\steam-output',
    branch: 'buildsmith',
  });

  expect(script).toContain('"AppID" "1000"');
  expect(script).toContain('"Desc" "1.2.3"');
  expect(script).toContain('"ContentRoot" "C:/builds/game"');
  expect(script).toContain('"SetLive" "buildsmith"');
  expect(script).toContain('"1001"');
  expect(script).toContain('"LocalPath" "*"');
});

test('an empty branch uploads without setting a branch live', () => {
  const script = appBuildScript({
    appId: '1000',
    depotId: '1001',
    description: '1.2.3',
    contentRoot: '/tmp/game',
    buildOutput: '/tmp/out',
    branch: '',
  });
  expect(script).toContain('"SetLive" ""');
});

test('steamcmd logs in and runs the build script', () => {
  expect(steamcmdArgs({ username: 'builder', scriptPath: 'app.vdf' })).toEqual([
    '+@ShutdownOnFailedCommand',
    '1',
    '+@NoPromptForPassword',
    '1',
    '+login',
    'builder',
    '+run_app_build',
    'app.vdf',
    '+quit',
  ]);
  expect(
    steamcmdArgs({ username: 'builder', password: 'secret', guardCode: 'ABCDE', scriptPath: 'app.vdf' })
  ).toContain('ABCDE');
});
