/**
 *
 * @param {import("zerespluginlibrary").Plugin} Plugin
 * @param {import("zerespluginlibrary").BoundAPI} Library
 * @returns
 */
module.exports = (Plugin, Library) => {
  const { Patcher, Logger, Filters } = Library;
  const Webpack = BdApi.Webpack;
  const waitForModule = BdApi.Webpack.waitForModule;
  return class CanaryLinks extends Plugin {
    onStart() {
      // discords copy to clipboard function
      this.copy = Webpack.getModule(
        Filters.combine((m) => m?.length === 1, Filters.byString("ClipboardUtils.copy()"))
      );

      this.Domain = "discord.com";
      this.Routes = Webpack.getModule(Filters.byProperties("CHANNEL", "INVITE", "ME"));

      waitForModule(
        Filters.combine((m) => m?.length === 2, Filters.byString("COPY_MESSAGE_LINK")),
        { defaultExport: false }
      ).then((copyLinkItem) => {
        Logger.info("We found it!", copyLinkItem);
        Patcher.after(copyLinkItem, "default", this.messageCopyLink.bind(this));
      });

      waitForModule(
        Filters.byCode(/location\.host.+\.CHANNEL\(/, (m) => m?.length === 3),
        { defaultExport: false }
      ).then((copyLinkItem) => {
        Patcher.after(copyLinkItem, "default", this.channelCopyLink.bind(this));
      });

      // the shift click menu and 3 dots menu on message hover
      const msgMenuItems = Webpack.getModule(
        Filters.byCode(/\)\(\w\.guild_id,\w\.id,\w\.id/, (m) => m?.length === 2),
        { defaultExport: false }
      );
      Patcher.instead(msgMenuItems, "default", this.buttonCopyLink.bind(this));
    }
    onStop() {
      Patcher.unpatchAll();
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
      // `useChannelCopyLinkItem`
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
      this.ClipboardUtils.copy(url);
    }
  };
};
