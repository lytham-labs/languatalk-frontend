module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { tsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    plugins: [
      ["module-resolver", {
        alias: {
          "@sentry/react-native": "@sentry/react-native/dist/js"
        }
      }]
    ]
  };
};
