/**
 *
 * @param {import("zerespluginlibrary").Plugin} Plugin
 * @param {import("zerespluginlibrary").BoundAPI} Library
 * @returns
 */
module.exports = (Plugin, Library) => {
  const Filters = Library.Filters;
  const { Patcher, Webpack } = BdApi;
  return class NoSpotifyPause extends Plugin {
    onStart() {
      const target = Webpack.getModule(Filters.byCode(/SPOTIFY_PLAYER_PAUSE/), {
        searchExports: true,
      });
      const spotifyModule = Webpack.getModule((x) => Object.values(x).includes(target));
      const [spotifyExportName] = Object.entries(spotifyModule).find(
        (entry) => entry[1] === target
      );
      Patcher.instead("NoSpotifyPause", spotifyModule, spotifyExportName, function () {});
    }
    onStop() {
      Patcher.unpatchAll("NoSpotifyPause");
    }
  };
};
