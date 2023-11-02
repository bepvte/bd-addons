/**
 *
 * @param {import("zerespluginlibrary").Plugin} Plugin
 * @param {import("zerespluginlibrary").BoundAPI} Library
 * @returns
 */
module.exports = (Plugin, _Library) => {
  const { Patcher, Webpack, React } = BdApi;
  return class NoSpotifyPause extends Plugin {
    onStart() {
      const target = Webpack.getByKeys("pause", "play", "SpotifyAPI");
      // we dont want to hide the notice if its not working
      if (target !== undefined) {
        this.notices = Webpack.getByRegex(/"div",\{className:.\(.\.notice,\{\[.\.isMobile/, {defaultExport: false});
        Patcher.instead("NoSpotifyPause", this.notices, "default", function (_this, [props], originalFunction) {
          if (props.children.some(x => x?.props?.noticeType === "SPOTIFY_AUTO_PAUSED")) {
            return React.createElement(React.Fragment, null);
          } else {
            return originalFunction(props)
          }
        })
      }
      Patcher.instead("NoSpotifyPause", target, "pause", () => {});
    }
    onStop() {
      Patcher.unpatchAll("NoSpotifyPause");
    }
  };
};
