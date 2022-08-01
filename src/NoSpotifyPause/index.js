module.exports = (Plugin, Library) => {
  const { Patcher, WebpackModules } = Library;
  return class NoSpotifyPause extends Plugin {
    onStart() {
      const spotify = WebpackModules.getByProps("fetchIsSpotifyProtocolRegistered");
      Patcher.instead(spotify, "pause", function () {});
    }
    onStop() {
      Patcher.unpatchAll();
    }
  };
};
