module.exports = (Plugin, Library) => {
  const { Patcher, WebpackModules, Filters, ContextMenu, DiscordModules } = Library;
  return class CanaryLinks extends Plugin {
    onStart() {
      // the ClipboardUtils module has no displayname and is only recognizable
      // through its singular `copy` function, but many modules have a `copy` property
      this.ClipboardUtils = WebpackModules.getModule((obj) => {
        const keys = Object.keys(obj);
        // so we find a module with only `copy`
        return keys.length === 1 && keys[0] === "copy";
      }, true);

      DiscordModules;
      const { DiscordConstants } = DiscordModules;
      this.Routes = DiscordConstants.Routes;
      this.Domain = DiscordConstants.PRIMARY_DOMAIN;

      // we have to use getByIndex to get the 'raw' module, because the module exports just a function
      // this is the thing in the right click menu
      ContextMenu.getDiscordMenu(Filters.byDisplayName("useMessageCopyLinkItem")).then(
        (copyLinkItem) => {
          Patcher.after(copyLinkItem, "default", this.messageCopyLink.bind(this));
        }
      );

      ContextMenu.getDiscordMenu(Filters.byDisplayName("useChannelCopyLinkItem")).then(
        (copyLinkItem) => {
          Patcher.after(copyLinkItem, "default", this.channelCopyLink.bind(this));
        }
      );

      // the shift click menu and 3 dots menu on message hover
      const msgMenuItems = WebpackModules.getByProps("copyLink", "pinMessage");
      Patcher.instead(msgMenuItems, "copyLink", this.buttonCopyLink.bind(this));
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
