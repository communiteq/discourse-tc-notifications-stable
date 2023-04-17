import { withPluginApi } from "discourse/lib/plugin-api";
import { helperContext } from "discourse-common/lib/helpers";

export default {
  name: "discourse-notifications-stable",

  initialize() {
    withPluginApi("0.8.0", (api) => {
        function myPushNotificationsSupported() {
            let caps = helperContext().capabilities;
            if (
              !(
                "serviceWorker" in navigator &&
                typeof ServiceWorkerRegistration !== "undefined" &&
                typeof Notification !== "undefined" &&
                "showNotification" in ServiceWorkerRegistration.prototype &&
                "PushManager" in window &&
                !caps.isAppWebview &&
                navigator.serviceWorker.controller &&
                navigator.serviceWorker.controller.state === "activated"
              )
            ) {
              return false;
            }
            return true;
        }
        api.modifyClass("component:desktop-notification-config", {
          isPushNotificationsPreferred() {
            return (
              (this.site.mobileView ||
                this.siteSettings.enable_desktop_push_notifications) && 
                myPushNotificationsSupported()
            );
          },
        });
    });
  }
}
