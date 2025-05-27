// jest.setup.js
global.isTestEnvironment = true;
global.chrome = {
  storage: {
    sync: {
      get: jest.fn((defaults, callback) => {
        // Simulate returning default values or previously set values
        // For simplicity, we'll just return the defaults for now.
        // You can expand this mock to store and retrieve values if needed.
        if (typeof callback === 'function') {
          callback(defaults);
        }
        return Promise.resolve(defaults);
      }),
      set: jest.fn((items, callback) => {
        // Simulate setting values. You can store them in a mock store if needed.
        if (typeof callback === 'function') {
          callback();
        }
        return Promise.resolve();
      }),
    },
    onChanged: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
      hasListener: jest.fn(),
    },
  },
  runtime: {
    // Mock other chrome.runtime APIs if needed
    getURL: (path) => `chrome-extension://your-extension-id/${path}`,
    // Add other runtime properties/methods your script might use
  }
};
