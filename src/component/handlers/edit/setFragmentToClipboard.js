/**
 * Copyright (c) 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule setFragmentToClipboard
 * @flow
 */

'use strict';

const DraftStringKey = require('DraftStringKey');

const encodeEntityRanges = require('encodeEntityRanges');
const encodeInlineStyleRanges = require('encodeInlineStyleRanges');

import type {BlockMap} from 'BlockMap';

function setFragmentToClipboard(blockMap: ?BlockMap, e: ?SyntheticClipboardEvent): BlockMap {
  if (e && e.clipboardData && blockMap) {
    const selection = window.getSelection();
    const textPlain = selection.toString();

    const holder = document.createElement('div');
    holder.appendChild(selection.getRangeAt(0).cloneContents());
    const textHtml = holder.innerHTML;

    const rawBlocks =  [];
    blockMap.forEach((block, blockKey) => {
      let entityStorageKey = 0;
      let entityStorageMap = {};

      block.findEntityRanges(
        character => character.getEntity() !== null,
        start => {
          // Stringify to maintain order of otherwise numeric keys.
          const stringifiedEntityKey = DraftStringKey.stringify(
            block.getEntityAt(start)
          );
          if (!entityStorageMap.hasOwnProperty(stringifiedEntityKey)) {
            entityStorageMap[stringifiedEntityKey] = '' + (entityStorageKey++);
          }
        }
      );

      rawBlocks.push({
        key: blockKey,
        text: block.getText(),
        type: block.getType(),
        depth: block.getDepth(),
        inlineStyleRanges: encodeInlineStyleRanges(block),
        entityRanges: encodeEntityRanges(block, entityStorageMap),
        data: block.getData().toObject(),
      });
    });

    const textDraft = JSON.stringify(rawBlocks);

    // in order to use setData we need to prevent the default
    e.preventDefault();

    e.clipboardData.setData('text/plain', textPlain);
    e.clipboardData.setData('text/html', textHtml);
    e.clipboardData.setData('text/draft', textDraft);
  }

  return blockMap;
}

module.exports = setFragmentToClipboard;
