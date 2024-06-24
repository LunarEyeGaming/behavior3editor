angular.module('app.notification', [])

/**
 * A controller responsible for creating and displaying notifications. Notifications are created and shown with the
 * `createNotification()` and `showNotification()` method respectively. Both are used in the `onNotification()` method,
 * which is triggered when the editor emits a `notification` event, with the provided `level` and `message` passed in as
 * arguments. The controller also limits the number of notifications that can be displayed at once to
 * `maxShownNotifications`, with the number of notifications being shown at once being tracked with the
 * `shownNotifications` field. If `shownNotifications` is at `maxShownNotifications` when `showNotification()` is
 * called, the notification is pushed onto a queue to be shown when a notification clears. The newest notifications are
 * shown first, with older notifications being shown later. If more than `maxQueueSize` notifications are already in the
 * queue when `showNotification()` is called and the notification is about to be added to the queue, it is instead
 * recorded as an "excess notification," thereby incrementing the `excessNotifications` counter. When the queue has been
 * cleared, another notification is shown to display these excess notifications if there are any.
 * 
 * All shown notifications are stored in the `pastNotifications` list, whose corresponding modal can be displayed by
 * invoking the `onButtonShowNotifications` method.
 */
.controller('NotificationController', function($scope, $window, $compile, $rootScope, ModalService) {
  var this_ = this;
  // li is necessary to make the notifications stack on top of each other.
  this.template = '\
  <li class="notification {0}">\
    {1}\
  </li>\
  ';
  this.fadeTime = 500;
  this.showTime = 3000;
  this.maxQueueSize = 15;  // The maximum number of notifications that can be in the queue.
  this.maxShownNotifications = 5;  // The maximum number of notifications to show at once.
  this.shownNotifications = 0;  // The number of notifications being shown.
  this.notificationQueue = [];  // The list of notifications that are waiting to be shown.
  this.excessNotifications = 0;  // The number of notifications that were queued when the queue size exceeded maxQueueSize

  this.pastNotifications = [];  // The list of all notifications shown.

  this.display = undefined;  // The Angular element representing the notification display.

  /**
   * Creates and returns an element representing a notification with level `level` and message `message`. The programmer
   * must ensure that `message` is a trusted HTML string, through means such as escaping the segments that come from the
   * user (see `b3editor.escapeHtml`).
   * 
   * @param {string} level the level of the notification to show. CSS-recognized levels are `info`, `success`, `warn`, 
   *   and `error`.
   * @param {string} message the contents of the notification to show
   * @returns an element representing the notification.
   */
  this.createNotification = function(level, message) {
    return $compile(
      this.template.format(level, message)
    )($scope);
  }

  /**
   * Forcibly shows a notification (regardless of how many notifications are being shown) represented by `element`.
   * 
   * @param {*} element the element representing the notification to display
   */
  this.showNotificationForce = function(element) {
    // If the display is not defined yet...
    if (!this.display)
      this.display = angular.element(document.querySelector("#notification-display"));  // Define it.
    
    var willDisappear = false;  // Closure variable for fadeOut.

    var fadeOut = function() {
      // If this element is not marked for disappearance...
      if (!willDisappear) {
        // Mark it for disappearance.
        willDisappear = true;

        // Make it fade out.
        element.css('opacity', 0);
  
        // Defer for removal. Note that the actual fade-out time of the element is configured in a CSS.
        setTimeout(function() {
          element.remove();
          this_.removeNotification();
        }, this_.fadeTime);
      }
    };

    // remove on click
    element.bind('click', fadeOut);

    // remove in time
    var timeoutId = setTimeout(fadeOut, this.showTime);

    // Cancel fadeOut timeout event on mouseenter.
    element.bind('mouseenter', function() {
      clearTimeout(timeoutId);
    });

    // Reapply fadeOut timeout event on mouseleave.
    element.bind('mouseleave', function() {
      timeoutId = setTimeout(fadeOut, this_.showTime);
    });

    // appear
    setTimeout(function() {
      element.css('opacity', 1);
    }, 1);

    // Increment shownNotifications counter.
    this.shownNotifications++;

    this.display.append(element);  // Add to display (which makes it render on the document).
  }

  /**
   * Attempts to show a notification. If `this.maxShownNotifications` are already being shown, the notification is
   * instead pushed onto the queue to be shown later. If more than `this.maxQueueSize` notifications are already on the
   * queue, the `this.excessNotifications` counter is incremented instead.
   * 
   * @param {*} element the element representing the notification to show
   */
  this.showNotification = function(element) {
    // If less than this.maxShownNotifications have been shown so far...
    if (this.shownNotifications < this.maxShownNotifications)
      this.showNotificationForce(element);  // Show notification.
    // Otherwise, if less than this.maxQueueSize notifications are in queue...
    else if (this.notificationQueue.length < this.maxQueueSize)
      this.notificationQueue.push(element);  // Push to queue
    else  // Otherwise...
      this.excessNotifications++;  // Increment the number of excess notifications
  }

  /**
   * Decrements the `this.shownNotifications` counter and shows the next remaining notification in the queue (if any are
   * remaining).
   */
  this.removeNotification = function() {
    // Decrement this.shownNotifications counter.
    this.shownNotifications--;

    // Try to take a notification out of the queue (by removing one from the beginning of the array)...
    var removed = this.notificationQueue.splice(0, 1);

    // If a notification was removed...
    if (removed.length > 0)
      // Show the notification.
      this.showNotification(removed[0]);
    else  // Otherwise...
      // If at least one notification cannot be shown due to the queue size limit being reached...
      if (this.excessNotifications > 0) {
        // Display the number of notifications missed in another notification.
        this.showNotification(this.createNotification(
          "info",
          // &#8594; = right arrow
          this.excessNotifications + " more notifications have been sent.<br>Select View &#8594; Show Notifications in the menu bar for more details."
        ));
        this.excessNotifications = 0; // Reset the counter.
      }
  }

  /**
   * Called when the `notification` event is emitted. The programmer must ensure that the `message` is a trusted HTML 
   * string through means such as HTML-escaping any segments (see `b3editor.escapeHtml`) that come from arbitrary input.
   * 
   * @param {{level: string, message: string}} e an event containing the `level` of the notification and its `message`.
   */
  this.onNotification = function(e) {
    this.pastNotifications.push({level: e.level, message: e.message});
    this.showNotification(this.createNotification(e.level, e.message));
  }

  this.onButtonShowNotifications = function() {
    ModalService.showModal({
      templateUrl: "app/common/notification/modal-notifications.html",
      controller: 'NotificationModalController',
      inputs: {pastNotifications: this.pastNotifications}
    }).then(function(modal) {
      modal.close.then(function(result) {});
    });
  }

  $window.app.editor.on('notification', (e) => this_.onNotification(e), this);
  $rootScope.$on('onButtonShowNotifications', () => this_.onButtonShowNotifications());
})

.controller('NotificationModalController', function($scope, $element, $compile, close, pastNotifications) {
  var this_ = this;

  this.template = '\
  <li class="notification {0}">\
    {1}\
  </li>\
  ';

  $scope.pastNotifications = pastNotifications;
  $scope.close = function(result) { close(result); };

  // Using a watch function instead of ng-repeat and ng-bind-html allows for displaying notifications with HTML.
  $scope.$watch("pastNotifications", function(notifications) {
    // Get notification list (jqLite-wrapped).
    var notificationList = angular.element($element[0].querySelector("#notification-list"));

    // Manually inject the notifications into the document.
    notifications.forEach(notification => {
      var notifElement = $compile(this_.template.format(notification.level, notification.message))($scope);

      notificationList.append(notifElement);
    });
  });

  $scope.clearNotifications = function() {
    // This clears the past notifications from the reference itself.
    $scope.pastNotifications.splice(0, $scope.pastNotifications.length);
  }
});
