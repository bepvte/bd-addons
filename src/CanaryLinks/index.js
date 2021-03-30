module.exports = (Plugin, Library) => {
  const { Patcher, WebpackModules, Filters } = Library;
  return class CanaryLinks extends Plugin {
    onStart() {
      // the ClipboardUtils module has no displayname and is only recognizable
      // through its singular `copy` function, but many modules have a `copy` property
      this.ClipboardUtils = WebpackModules.getModule((obj) => {
        const keys = Object.keys(obj);
        // so we find a module with only `copy`
        return keys.length === 1 && keys[0] === "copy";
      }, true);
      // we have to use getByIndex to get the 'raw' module, because the modules exports just a function
      this.copyLinkItem = WebpackModules.getByIndex(
        WebpackModules.getIndex(Filters.byDisplayName("useMessageCopyLinkItem"))
      );
      Patcher.after(this.copyLinkItem, "default", this.replacement.bind(this));
    }
    replacement(_that, args, reactElement) {
      // `useMessageCopyLinkItem` returns undefined if its not a `SUPPORTS_COPY`
      if (reactElement) {
        // original action:
        // return (0, o.copy)(location.protocol + "//" + location.host + u.Routes.CHANNEL(t.guild_id, t.id, e.id))
        reactElement.props.action = () => {
          const [message, channel] = args;
          this.ClipboardUtils.copy(
            `https://discord.com/channels/${channel.guild_id}/${channel.id}/${message.id}`
          );
        };
      }
    }
    onStop() {
      Patcher.unpatchAll();
    }
  };
};
