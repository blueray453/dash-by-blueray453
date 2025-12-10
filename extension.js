import GLib from 'gi://GLib';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { Dash } from 'resource:///org/gnome/shell/ui/dash.js';
import { ControlsState } from 'resource:///org/gnome/shell/ui/overviewControls.js';
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

    // Hide the original dash in overview
    this._originalDash = Main.overview.dash;
    this._originalDashParent = this._originalDash.get_parent();

    // Create new dash container
    this._dockContainer = new St.Widget({
      name: 'dockContainer',
      reactive: true,
      layout_manager: new Clutter.BinLayout(),
      x_align: Clutter.ActorAlign.CENTER,
      y_align: Clutter.ActorAlign.CENTER,
    });

    // Create a new dash instance for our dock
    this._dash = new Dash();
    this._dash.iconSize = 96;
    this._dash._maxIconSize = 96;

    // Connect Show Apps button to overview
    this._showAppsButtonId = this._dash._showAppsIcon.toggleButton.connect('clicked', () => {
      if (Main.overview.visible) {
        Main.overview.hide();
      } else {
        Main.overview.show(ControlsState.APP_GRID);
      }
    });

    // Add dash to container
    this._dockContainer.add_child(this._dash);

    this._dockContainer.set_position(1000,1000);

    // Add to main layout
    Main.layoutManager.addChrome(this._dockContainer, {
      affectsStruts: true,
      trackFullscreen: true,
    });

    // Hide original dash when overview shows
    this._overviewShowingId = Main.overview.connect('showing', () => {
      this._originalDash.hide();
    });

    this._overviewHiddenId = Main.overview.connect('hidden', () => {
      this._originalDash.hide();
    });

    // Hide it immediately
    this._originalDash.hide();
  }

  disable() {
    // Disconnect signals
    // Disconnect signals
    if (this._showAppsButtonId) {
      this._dash._showAppsIcon.toggleButton.disconnect(this._showAppsButtonId);
      this._showAppsButtonId = null;
    }

    if (this._overviewShowingId) {
      Main.overview.disconnect(this._overviewShowingId);
      this._overviewShowingId = null;
    }

    if (this._overviewHiddenId) {
      Main.overview.disconnect(this._overviewHiddenId);
      this._overviewHiddenId = null;
    }

    // Remove dock container and dash
    if (this._dockContainer) {
      Main.layoutManager.removeChrome(this._dockContainer);
      this._dockContainer.destroy();
      this._dockContainer = null;
    }

    // Restore original dash visibility
    if (this._originalDash) {
      this._originalDash.show();
    }

    this._dash = null;
    this._originalDash = null;
    this._originalDashParent = null;
  }
}
