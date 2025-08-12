export default {
  Asset: {
    loadAsync: jest.fn(),
    fromModule: jest.fn(),
    fromURI: jest.fn(),
    fromMetadata: jest.fn(),
  },
  AssetMetadata: {
    hash: 'mock-hash',
    name: 'mock-asset',
    type: 'mock-type',
    uri: 'mock-uri',
    width: 100,
    height: 100,
  },
}; 