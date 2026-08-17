import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import Gio from 'gi://Gio';
import Shell from 'gi://Shell';

const DBUS_IFACE = `
<node>
  <interface name="org.gnome.Shell.Extensions.CircleSearch">
    <method name="Capture">
      <!-- type="s": string -->
      <arg type="s" name="target_file_path" direction="in"/>
      <!-- type="b": boolean -->
      <arg type="b" name="is_success" direction="out"/>
    </method>
  </interface>
</node>`;

export default class CircleSearchExtension extends Extension {
    enable() {
        this._screenshot = new Shell.Screenshot();

        const impl = {
            Capture: (target_file_path) => {
                return new Promise((resolve) => {
                    try {
                        const file = Gio.File.new_for_path(target_file_path);
                        const stream = file.replace(null, false, Gio.FileCreateFlags.NONE, null);

                        this._screenshot.screenshot(false, stream, (obj, res) => {
                            try {
                                this._screenshot.screenshot_finish(res);
                                stream.close(null);
                                resolve(true);
                            } catch (e) {
                                console.error('CircleSearch capture finish failed:', e);
                                try { stream.close(null); } catch (_) {}
                                resolve(false);
                            }
                        });
                    } catch (e) {
                        console.error('CircleSearch capture stream error:', e);
                        resolve(false);
                    }
                });
            }
        };

        this._dbusImpl = Gio.DBusExportedObject.wrapJSObject(DBUS_IFACE, impl);
        this._dbusImpl.export(Gio.DBus.session, '/org/gnome/Shell/Extensions/CircleSearch');
    }

    disable() {
        if (this._dbusImpl) {
            this._dbusImpl.unexport();
            this._dbusImpl = null;
        }
        this._screenshot = null;
    }
}