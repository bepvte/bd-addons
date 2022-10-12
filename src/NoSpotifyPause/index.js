/**
 *
 * @param {import("zerespluginlibrary").Plugin} Plugin
 * @param {import("zerespluginlibrary").BoundAPI} Library
 * @returns
 */
module.exports = (Plugin, Library) => {
  const { Patcher, Filters, Logger } = Library;
  const Webpack = BdApi.Webpack;
  return class NoSpotifyPause extends Plugin {
    onStart() {
      const target = Webpack.getModule(Filters.byCode(/SPOTIFY_PLAYER_PAUSE/), {
        searchExports: true,
      });
      const spotifyModule = Webpack.getModule((x) => Object.values(x).includes(target));
      const [spotifyExportName] = Object.entries(spotifyModule).find(
        (entry) => entry[1] === target
      );
      Logger.info("yay", target, spotifyModule, spotifyExportName);
      Patcher.instead(spotifyModule, spotifyExportName, function () {});
      // for some reason the getter was never calling and the patch wouldnt work
      spotifyModule[spotifyExportName] = undefined;
    }
    onStop() {
      Patcher.unpatchAll();
    }
  };
};
