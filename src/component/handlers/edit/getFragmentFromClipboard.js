/**
 * Copyright (c) 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule getFragmentFromClipboard
 * @flow
 */

'use strict';

const ContentBlock = require('ContentBlock');
const ContentState = require('ContentState');
const Immutable = require('immutable');

const createCharacterList = require('createCharacterList');
const decodeEntityRanges = require('decodeEntityRanges');
const decodeInlineStyleRanges = require('decodeInlineStyleRanges');

import type {BlockMap} from 'BlockMap';

const {
  Map,
} = Immutable;

function getDraftClipBoardData(e: ?SyntheticClipboardEvent) : ?string {
  const hasDraftMimeType = (
    e &&
    e.clipboardData &&
    e.clipboardData.types &&
    e.clipboardData.types.indexOf('text/draft') !== -1
  );

  if (!hasDraftMimeType) {
    return null;
  }

  const clipboardData = (
    e &&
    e.clipboardData &&
    e.clipboardData.getData &&
    e.clipboardData.types &&
    e.clipboardData.types.indexOf('text/draft') !== -1
  ) ? e.clipboardData.getData('text/draft') : null;

  return clipboardData;
}

function getFragmentFromClipboard(e: ?SyntheticClipboardEvent): ?BlockMap {
  const clipboardData = getDraftClipBoardData(e);

  if (!clipboardData) {
    return null;
  }

  const rawBlocks = JSON.parse(clipboardData);
  const contentBlocks = rawBlocks.map(
    block => {
      const {
        key,
        type,
        text,
        depth,
        inlineStyleRanges,
        data,
      } = block;
      const blockDepth = depth || 0;
      const blockInlineStyleRanges = inlineStyleRanges || [];
      const blockData = new Map(data);

      const inlineStyles = decodeInlineStyleRanges(text, blockInlineStyleRanges);

      // TODO: enable entities to be persisted
      const entities = decodeEntityRanges(text, []);
      const characterList = createCharacterList(inlineStyles, entities);

      return new ContentBlock({
        key,
        type,
        text,
        blockDepth,
        characterList,
        blockData,
      });
    }
  );

  const contentState = ContentState.createFromBlockArray(contentBlocks);

  return contentState.get('blockMap');
}

module.exports = getFragmentFromClipboard;
