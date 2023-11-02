/**
 *
 * @param {import("zerespluginlibrary").Plugin} Plugin
 * @param {import("zerespluginlibrary").BoundAPI} Library
 * @returns
 */
module.exports = (Plugin, _Library) => {
  const { Webpack: {Filters}, Webpack, Patcher } = BdApi;
  return class CanaryLinks extends Plugin {
    onStart() {
      // discords copy to clipboard function
      this.copy = Webpack.getModule(
        Filters.combine(
          (m) => m?.length === 1,
          Filters.byStrings("ClipboardUtils.copy()")
        ),
        { searchExports: true }
      );

      this.Domain = "discord.com";
      this.Routes = Webpack.getModule(
        Filters.byKeys("CHANNEL", "MESSAGE_REQUESTS"),
        {
          searchExports: true,
        }
      );

      const {abort, signal} = new AbortController();
      this.abort = abort;

      // message link copy
      Webpack.waitForModule(Filters.byStrings("COPY_MESSAGE_LINK"), {
        defaultExport: false,
        signal: signal,
      }).then((copyLinkItem) => {
        // Patcher.after(copyLinkItem, "Z", this.messageCopyLink.bind(this));
        Patcher.after("CanaryLinks", copyLinkItem, "default", this.messageCopyLink.bind(this));
      });

      // channel link copy
      Webpack.waitForModule(Filters.byStrings('id:"channel-copy-link"'), {
        defaultExport: false,
        signal: signal,
      }).then((copyLinkItem) => {
        Patcher.after("CanaryLinks", copyLinkItem, "default", this.channelCopyLink.bind(this));
      });

      // the shift click menu and 3 dots menu on message hover
      const msgMenuItems = Webpack.getByKeys("copyLink","createThread", "editMessage");
      Patcher.instead("CanaryLinks", msgMenuItems, "copyLink", this.buttonCopyLink.bind(this));
    }
    onStop() {
      this.abort();
      Patcher.unpatchAll("CanaryLinks");
    }

    // modify things that make react elements
    messageCopyLink(_thisobj, args, reactElement) {
      // `useMessageCopyLinkItem` returns undefined if its not a `SUPPORTS_COPY`
      if (reactElement) {
        // original action:
        // return (0, o.copy)(location.protocol + "//" + location.host + u.Routes.CHANNEL(t.guild_id, t.id, e.id))
        reactElement.props.action = () => {
          this.copyLink(args[1], args[0]);
        };
      }
      return reactElement;
    }
    channelCopyLink(_thisobj, args, reactElement) {
      // skipping original tracking metadata thing
      reactElement.props.action = () => {
        this.copyLink(args[0]);
      };
      return reactElement;
    }

    // function that is stored in the shift button menu giant list of functions
    buttonCopyLink(_thisobj, args) {
      this.copyLink(args[0], args[1]);
    }

    // utility
    copyLink(channel, message) {
      let url;
      if (message === undefined || message["id"] === undefined) {
        url =
          location.protocol +
          "//" +
          this.Domain +
          this.Routes.CHANNEL(channel.guild_id, channel.id);
      } else {
        url =
          location.protocol +
          "//" +
          this.Domain +
          this.Routes.CHANNEL(channel.guild_id, channel.id, message.id);
      }
      this.copy(url);
    }
  };
};
