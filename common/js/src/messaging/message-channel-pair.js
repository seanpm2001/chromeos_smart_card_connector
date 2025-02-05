/**
 * @license
 * Copyright 2016 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview This file contains a class that provides a way to create a pair
 * of message channels linked to each other. This class is useful in the cases
 * when it's necessary to connect two pieces of code that are both implemented
 * to communicate through the message channel abstraction, but for some reason
 * live in the same JavaScript context.
 */

goog.provide('GoogleSmartCard.MessageChannelPair');

goog.require('GoogleSmartCard.Logging');
goog.require('goog.Disposable');
goog.require('goog.async.nextTick');
goog.require('goog.log.Logger');
goog.require('goog.messaging.AbstractChannel');

goog.scope(function() {

const GSC = GoogleSmartCard;

/** @type {!goog.log.Logger} */
const logger = GSC.Logging.getScopedLogger('MessageChannelPair');

/**
 * This class provides a way to create a pair of message channels linked to each
 * other.
 *
 * When a message is sent through one message channel from the pair, it gets
 * received by the other message channel from the pair, and vice versa.
 *
 * Note that messages that are sent through the channel pair are always
 * delivered asynchronously.
 */
GSC.MessageChannelPair = class extends goog.Disposable {
  constructor() {
    super();

    /**
     * @type {!Array.<!MessageChannelPairItem>}
     * @private
     */
    this.items_ = [
      new MessageChannelPairItem(this, 0), new MessageChannelPairItem(this, 1)
    ];
  }

  /**
   * @param {number} itemIndex
   * @return {!goog.messaging.AbstractChannel}
   */
  getItem(itemIndex) {
    GSC.Logging.checkWithLogger(logger, 0 <= itemIndex && itemIndex <= 1);
    GSC.Logging.checkWithLogger(logger, !this.isDisposed());
    return this.items_[itemIndex];
  }

  /**
   * @return {!goog.messaging.AbstractChannel}
   */
  getFirst() {
    return this.getItem(0);
  }

  /**
   * @return {!goog.messaging.AbstractChannel}
   */
  getSecond() {
    return this.getItem(1);
  }

  /** @override */
  disposeInternal() {
    for (let item of this.items_)
      item.dispose();
    this.items_ = [];
    super.disposeInternal();
  }

  /**
   * @param {number} fromItemIndex
   * @param {string} serviceName
   * @param {!Object|string} payload
   * @private
   */
  sendFrom_(fromItemIndex, serviceName, payload) {
    // Deliver the message to the target message channel asynchronously, because
    // that's how the real message channels usually work.
    goog.async.nextTick(() => {
      if (this.isDisposed()) {
        // Bail out if we got disposed of in the meantime.
        return;
      }
      const targetItem = this.items_[1 - fromItemIndex];
      targetItem.deliver_(serviceName, payload);
    });
  }
};

/**
 * A message channel which is an element of the message channel pair.
 */
class MessageChannelPairItem extends goog.messaging.AbstractChannel {
  /**
   * @param {!GSC.MessageChannelPair} messageChannelPair
   * @param {number} indexInPair
   */
  constructor(messageChannelPair, indexInPair) {
    super();

    /** @private */
    this.messageChannelPair_ = messageChannelPair;
    /** @private @const */
    this.indexInPair_ = indexInPair;
  }

  /** @override */
  send(serviceName, payload) {
    GSC.Logging.checkWithLogger(logger, !this.isDisposed());
    this.messageChannelPair_.sendFrom_(this.indexInPair_, serviceName, payload);
  }

  /** @override */
  disposeInternal() {
    // Our disposal triggers the disposal of the whole pair and, hence, disposal
    // of the second item of the pair.
    this.messageChannelPair_.dispose();
    this.messageChannelPair_ = undefined;
    super.disposeInternal();
  }

  /**
   * @param {string} serviceName
   * @param {!Object|string} payload
   * @private
   */
  deliver_(serviceName, payload) {
    GSC.Logging.checkWithLogger(logger, !this.isDisposed());
    this.deliver(serviceName, payload);
  }
};
});  // goog.scope
