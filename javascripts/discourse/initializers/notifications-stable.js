import { withPluginApi } from "discourse/lib/plugin-api";
import { helperContext } from "discourse-common/lib/helpers";
import { ajax } from "discourse/lib/ajax";
import KeyValueStore from "discourse/lib/key-value-store";

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

          actions: {
            turnoff() {
                function myUnsubscribePushNotification(user, callback) {
                    const keyValueStore = new KeyValueStore("discourse_push_notifications_");
                    keyValueStore.setItem(userSubscriptionKey(user), "");
                    navigator.serviceWorker.ready.then((serviceWorkerRegistration) => {
                      serviceWorkerRegistration.pushManager
                        .getSubscription()
                        .then((subscription) => {
                          if (subscription) {
                            subscription.unsubscribe().then((successful) => {
                              if (successful) {
                                ajax("/push_notifications/unsubscribe", {
                                  type: "POST",
                                  data: { subscription: subscription.toJSON() },
                                });
                              }
                            });
                          }
                        })
                        .catch((e) => {
                          // eslint-disable-next-line no-console
                          console.error(e);
                        });
                      if (callback) {
                        callback();
                      }
                    });
                }
                if (this.isEnabledDesktop) {
                    this.set("notificationsDisabled", "disabled");
                    this.notifyPropertyChange("notificationsPermission");
                }
                if (this.isEnabledPush) {
                    myUnsubscribePushNotification(this.currentUser, () => {
                      this.set("isEnabledPush", "");
                    });
                }
            },
            turnon() {
                function mySubscribePushNotification(callback, applicationServerKey) {
                    navigator.serviceWorker.ready.then((serviceWorkerRegistration) => {
                      serviceWorkerRegistration.pushManager
                        .subscribe({
                          userVisibleOnly: true,
                          applicationServerKey: new Uint8Array(applicationServerKey.split("|")), // eslint-disable-line no-undef
                        })
                        .then((subscription) => {
                          sendSubscriptionToServer(subscription, true);
                          if (callback) {
                            callback();
                          }
                        })
                        .catch((e) => {
                          // eslint-disable-next-line no-console
                          console.error(e);
                        });
                    });
                }
                function sendSubscriptionToServer(subscription, sendConfirmation) {
                    ajax("/push_notifications/subscribe", {
                        type: "POST",
                        data: {
                        subscription: subscription.toJSON(),
                        send_confirmation: sendConfirmation,
                        },
                    });
                }

                if (this.isPushNotificationsPreferred()) {
                  mySubscribePushNotification(() => {
                    this.set("isEnabledPush", "subscribed");
                  }, this.siteSettings.vapid_public_key_bytes);
                } else {
                  this.set("notificationsDisabled", "");
                  Notification.requestPermission(() => {
                    confirmNotification(this.siteSettings);
                    this.notifyPropertyChange("notificationsPermission");
                  });
                }
              },
            }
        });
    });
  }
}
