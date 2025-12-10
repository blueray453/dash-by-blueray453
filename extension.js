import GLib from 'gi://GLib';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { Dash } from 'resource:///org/gnome/shell/ui/dash.js';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import { setLogging, setLogFn, journal } from './utils.js';

export default class NotificationThemeExtension extends Extension {
  enable() {
    setLogFn((msg, error = false) => {
      let level;
      if (error) {
        level = GLib.LogLevelFlags.LEVEL_CRITICAL;
      } else {
        level = GLib.LogLevelFlags.LEVEL_MESSAGE;
      }

      GLib.log_structured(
        'fix-dash-by-blueray453',
        level,
        {
          MESSAGE: `${msg}`,
          SYSLOG_IDENTIFIER: 'fix-dash-by-blueray453',
          CODE_FILE: GLib.filename_from_uri(import.meta.url)[0]
        }
      );
    });

    setLogging(true);

    // journalctl -f -o cat SYSLOG_IDENTIFIER=fix-dash-by-blueray453
    journal(`Enabled`);

    this._oldDash = Main.overview.dash;

    // Create new dash container
    this._dockContainer = new St.Widget({
      name: 'dockContainer',
      reactive: true,
      layout_manager: new Clutter.BinLayout(),
      x_align: Clutter.ActorAlign.CENTER,
      y_align: Clutter.ActorAlign.END,
    });

    // Get the dash from overview
    this._dash = Main.overview.dash;

    // Set icon size to 96
    this._dash.iconSize = 96;
    this._dash._maxIconSize = 96;

    // Reparent dash to our container
    this._dash.get_parent()?.remove_child(this._dash);
    this._dockContainer.add_child(this._dash);

    // Add to panel container (main stage)
    Main.layoutManager.addChrome(this._dockContainer, {
      affectsStruts: true,
      trackFullscreen: true,
    });

    // Hide dash in overview
    this._overviewShowingId = Main.overview.connect('showing', () => {
      this._oldDash.hide();
    });

    this._overviewHiddenId = Main.overview.connect('hidden', () => {
      this._oldDash.hide();
    });

    // Always show our dock
    this._dash.show();
  }

  disable() {
    // Disconnect signals
    if (this._overviewShowingId) {
      Main.overview.disconnect(this._overviewShowingId);
      this._overviewShowingId = null;
    }

    if (this._overviewHiddenId) {
      Main.overview.disconnect(this._overviewHiddenId);
      this._overviewHiddenId = null;
    }

    // Remove dock container
    if (this._dockContainer) {
      Main.layoutManager.removeChrome(this._dockContainer);
      this._dockContainer.destroy();
      this._dockContainer = null;
    }

    // Restore original dash
    if (this._oldDash) {
      this._oldDash.show();
    }

    this._dash = null;
    this._oldDash = null;
  }
}
