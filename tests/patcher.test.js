const { missingChunks } = require('../src/js/patcher');

test('missing chunks are the hashes the installed manifest does not have', () => {
  const local = {
    files: [{ path: 'a.txt', sha256: 'file-a', chunks: [{ sha256: 'aaa', offset: 0, length: 3 }] }],
  };
  const target = {
    files: [
      { path: 'a.txt', sha256: 'file-a', chunks: [{ sha256: 'aaa', offset: 0, length: 3 }] },
      {
        path: 'b.txt',
        sha256: 'file-b',
        chunks: [
          { sha256: 'aaa', offset: 0, length: 3 },
          { sha256: 'bbb', offset: 3, length: 3 },
        ],
      },
    ],
  };

  expect(missingChunks(local, target)).toEqual(['bbb']);
  expect(missingChunks(null, target)).toEqual(['aaa', 'bbb']);
});
