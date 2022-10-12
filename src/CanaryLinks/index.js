/**
 *
 * @param {import("zerespluginlibrary").Plugin} Plugin
 * @param {import("zerespluginlibrary").BoundAPI} Library
 * @returns
 */
module.exports = (Plugin, Library) => {
  const { Patcher, Filters } = Library;
  const Webpack = BdApi.Webpack;
  return class CanaryLinks extends Plugin {
    onStart() {
      // discords copy to clipboard function
      this.copy = Webpack.getModule(
        Filters.combine(
          (m) => m?.length === 1,
          Filters.byString("ClipboardUtils.copy()")
        ),
        { searchExports: true }
      );

      this.Domain = "discord.com";
      this.Routes = Webpack.getModule(
        Filters.byProperties(["CHANNEL", "MESSAGE_REQUESTS"]),
        {
          searchExports: true,
        }
      );

      // message link copy
      Webpack.waitForModule(Filters.byString("COPY_MESSAGE_LINK"), {
        defaultExport: false,
      }).then((copyLinkItem) => {
        Patcher.after(copyLinkItem, "Z", this.messageCopyLink.bind(this));
      });

      // channel link copy
      Webpack.waitForModule(Filters.byString('id:"channel-copy-link"'), {
        defaultExport: false,
      }).then((copyLinkItem) => {
        Patcher.after(copyLinkItem, "Z", this.channelCopyLink.bind(this));
      });

      // the shift click menu and 3 dots menu on message hover
      const msgMenuExport = Webpack.getModule(
        Filters.byCode(/\)\(\w\.guild_id,\w\.id,\w\.id/),
        { searchExports: true }
      );
      const msgMenuItems = Webpack.getModule((x) =>
        Object.values(x).includes(msgMenuExport)
      );
      const [msgMenuExportName] = Object.entries(msgMenuItems).find(
        (entry) => entry[1] === msgMenuExport
      );
      Patcher.instead(msgMenuItems, msgMenuExportName, this.buttonCopyLink.bind(this));
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
