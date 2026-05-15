// __mocks__/expo-file-system-legacy.js
// Jest manual mock for the expo-file-system/legacy import path
module.exports = {
  documentDirectory: 'file:///tmp/',
  writeAsStringAsync: jest.fn(async () => {}),
  readAsStringAsync: jest.fn(async () => ''),
  deleteAsync: jest.fn(async () => {}),
  getInfoAsync: jest.fn(async () => ({ exists: true })),
};
