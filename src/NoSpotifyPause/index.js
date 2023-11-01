/**
 *
 * @param {import("zerespluginlibrary").Plugin} Plugin
 * @param {import("zerespluginlibrary").BoundAPI} Library
 * @returns
 */
module.exports = (Plugin, Library) => {
  const { Patcher, Webpack } = BdApi;
  return class NoSpotifyPause extends Plugin {
    onStart() {
      const target = Webpack.getByKeys("pause", "play", "SpotifyAPI");
      Patcher.instead("NoSpotifyPause", target, "pause", () => {})
    }
    onStop() {
      Patcher.unpatchAll("NoSpotifyPause");
    }
  };
};
