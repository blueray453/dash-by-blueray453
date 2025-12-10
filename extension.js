import GLib from 'gi://GLib';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { ControlsState } from 'resource:///org/gnome/shell/ui/overviewControls.js';
import { Dash } from 'resource:///org/gnome/shell/ui/dash.js';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import { setLogging, setLogFn, journal } from './utils.js';


class DashMenuButton extends PanelMenu.Button {
  static {
    GObject.registerClass(this);
  }

  _init(dash) {
    super._init(0.5, 'Dash Menu');
    this._dash = dash;
    // Create icon for the panel button
    let icon = new St.Icon({
      icon_name: 'view-app-grid-symbolic',
      style_class: 'system-status-icon',
    });
    this.add_child(icon);
    // Create a container for the dash in the menu
    let dashContainer = new St.Widget({
      layout_manager: new Clutter.BinLayout(),
    });
    dashContainer.add_child(this._dash);
    // Add to menu
    this.menu.box.add_child(dashContainer);
    // Prevent menu from closing when clicking on dash
    this.menu.actor.reactive = true;
  }
}

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
        'dash-by-blueray453',
        level,
        {
          MESSAGE: `${msg}`,
          SYSLOG_IDENTIFIER: 'dash-by-blueray453',
          CODE_FILE: GLib.filename_from_uri(import.meta.url)[0]
        }
      );
    });

    setLogging(true);

    // journalctl -f -o cat SYSLOG_IDENTIFIER=dash-by-blueray453
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

    // Create panel button with dash menu
    this._indicator = new DashMenuButton(this._dash);
    Main.panel.addToStatusArea('dash-menu', this._indicator);

    // Connect Show Apps button to overview
    this._showAppsButtonId = this._dash._showAppsIcon.toggleButton.connect('clicked', () => {
      const { currentState } = Main.overview._overview.controls._stateAdjustment.getStateTransitionParams();

      journal(`cs ${currentState}`);

      // Check if overview is actually visible
      if (!Main.overview.visible) {
        // Overview is hidden, show APP_GRID
        Main.overview.show(ControlsState.APP_GRID);
      } else if (currentState === ControlsState.WINDOW_PICKER) {
        // In WINDOW_PICKER, switch to APP_GRID instantly
        Main.overview._overview.controls._stateAdjustment.value = ControlsState.APP_GRID;
        Main.overview._overview.controls.dash.showAppsButton.checked = true;
        // // In WINDOW_PICKER, switch to APP_GRID
        // Main.overview._overview.controls._stateAdjustment.ease(ControlsState.APP_GRID, {
        //   duration: 250, // SIDE_CONTROLS_ANIMATION_TIME
        //   mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        //   onComplete: () => {
        //     Main.overview._overview.controls.dash.showAppsButton.checked = true;
        //   }
        // });
      } else if (currentState === ControlsState.APP_GRID) {
        // Already in APP_GRID, so hide overview
        Main.overview.hide();
      }

      if (currentState === ControlsState.WINDOW_PICKER) {
        Main.overview._overview.controls._stateAdjustment.value = ControlsState.APP_GRID;
        Main.overview._overview.controls.dash.showAppsButton.checked = true;

      } else if (currentState === ControlsState.HIDDEN) {
        // Overview not visible, show APP_GRID
        Main.overview.show(ControlsState.APP_GRID);
      } else if (currentState === ControlsState.APP_GRID) {
        // Already in APP_GRID, so hide overview
        Main.overview.hide();
      }

      // Close the menu when interacting with overview
      this.menu.close();
    });

    // // Add dash to container
    // this._dockContainer.add_child(this._dash);

    // this._dockContainer.set_position(1000,1000);

    // // Add to main layout
    // Main.layoutManager.addChrome(this._dockContainer, {
    //   affectsStruts: true,
    //   trackFullscreen: true,
    // });

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
