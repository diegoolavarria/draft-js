/**
 * Copyright (c) 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ContentState
 * @format
 * @flow
 */
'use strict';

import type {BlockMap} from 'BlockMap';
import type {BlockNodeRecord} from 'BlockNodeRecord';
import type DraftEntityInstance from 'DraftEntityInstance';
import type {DraftEntityMutability} from 'DraftEntityMutability';
import type {DraftEntityType} from 'DraftEntityType';

const BlockMapBuilder = require('BlockMapBuilder');
const CharacterMetadata = require('CharacterMetadata');
const ContentBlock = require('ContentBlock');
const ContentBlockNode = require('ContentBlockNode');
const DraftEntity = require('DraftEntity');
const Immutable = require('immutable');
const SelectionState = require('SelectionState');

const generateRandomKey = require('generateRandomKey');
const gkx = require('gkx');
const sanitizeDraftText = require('sanitizeDraftText');

const {List, Record, Repeat} = Immutable;

const experimentalTreeDataSupport = gkx('draft_tree_data_support');

const defaultRecord: {
  entityMap: ?any,
  blockMap: ?BlockMap,
  selectionBefore: ?SelectionState,
  selectionAfter: ?SelectionState,
} = {
  entityMap: null,
  blockMap: null,
  selectionBefore: null,
  selectionAfter: null,
};

const ContentBlockNodeRecord = experimentalTreeDataSupport
  ? ContentBlockNode
  : ContentBlock;

const ContentStateRecord = Record(defaultRecord);

class ContentState extends ContentStateRecord {
  getEntityMap(): any {
    // TODO: update this when we fully remove DraftEntity
    return DraftEntity;
  }

  getBlockMap(): BlockMap {
    return this.get('blockMap');
  }

  getSelectionBefore(): SelectionState {
    return this.get('selectionBefore');
  }

  getSelectionAfter(): SelectionState {
    return this.get('selectionAfter');
  }

  getBlockForKey(key: string): BlockNodeRecord {
    var block: BlockNodeRecord = this.getBlockMap().get(key);
    return block;
  }

  getFirstLevelBlocks(): BlockMap {
    return this.getBlockChildren('');
  }

  /*
   * This algorithm is used to create the blockMap nesting as well as to
   * enhance performance checks for nested blocks allowing each block to
   * know when any of it's children has changed.
   */
  getBlockDescendants() {
    return this.getBlockMap()
      .reverse()
      .reduce((treeMap, block) => {
        const key = block.getKey();
        const parentKey = block.getParentKey();
        const rootKey = '__ROOT__';

        // create one if does not exist
        const blockList = (
          treeMap.get(key) ?
            treeMap :
            treeMap.set(key, new Immutable.Map({
              firstLevelBlocks: new Immutable.OrderedMap(),
              childrenBlocks: new Immutable.Set()
            }))
        );

        if (parentKey) {
          // create one if does not exist
          const parentList = (
            blockList.get(parentKey) ?
              blockList :
              blockList.set(parentKey, new Immutable.Map({
                firstLevelBlocks: new Immutable.OrderedMap(),
                childrenBlocks: new Immutable.Set()
              }))
          );

          // add current block to parent children list
          const addBlockToParentList = parentList.setIn([parentKey, 'firstLevelBlocks', key], block);
          const addGrandChildren = addBlockToParentList.setIn(
            [parentKey, 'childrenBlocks'],
            addBlockToParentList.getIn([parentKey, 'childrenBlocks'])
              .add(
                // we include all the current block children and itself
                addBlockToParentList.getIn([key, 'childrenBlocks']).add(block)
              )
          );

          return addGrandChildren;
        } else {
          // we are root level block
          // lets create a new key called firstLevelBlocks
          const rootLevelBlocks = (
            blockList.get(rootKey) ?
              blockList :
              blockList.set(rootKey, new Immutable.Map({
                firstLevelBlocks: new Immutable.OrderedMap(),
                childrenBlocks: new Immutable.Set()
              }))
          );

          const rootFirstLevelBlocks = rootLevelBlocks.setIn([rootKey, 'firstLevelBlocks', key], block);

          const addToRootChildren = rootFirstLevelBlocks.setIn(
            [rootKey, 'childrenBlocks'],
            rootFirstLevelBlocks.getIn([rootKey, 'childrenBlocks'])
              .add(
                // we include all the current block children and itself
                rootFirstLevelBlocks.getIn([key, 'childrenBlocks']).add(block)
              )
          );

          return addToRootChildren;
        }
      }, new Immutable.Map())
      .map((block) => block.set('firstLevelBlocks', block.get('firstLevelBlocks').reverse()));
  }

  getBlockChildren(key: string): BlockMap {
    return this.getBlockMap()
    .filter(function(block) {
      return block.getParentKey() === key;
    });
  }

  getKeyBefore(key: string): ?string {
    return this.getBlockMap()
      .reverse()
      .keySeq()
      .skipUntil(v => v === key)
      .skip(1)
      .first();
  }

  getKeyAfter(key: string): ?string {
    return this.getBlockMap()
      .keySeq()
      .skipUntil(v => v === key)
      .skip(1)
      .first();
  }

  getBlockAfter(key: string): ?BlockNodeRecord {
    return this.getBlockMap()
      .skipUntil((_, k) => k === key)
      .skip(1)
      .first();
  }

  getBlockBefore(key: string): ?BlockNodeRecord {
    return this.getBlockMap()
      .reverse()
      .skipUntil((_, k) => k === key)
      .skip(1)
      .first();
  }

  getBlocksAsArray(): Array<BlockNodeRecord> {
    return this.getBlockMap().toArray();
  }

  getFirstBlock(): BlockNodeRecord {
    return this.getBlockMap().first();
  }

  getLastBlock(): BlockNodeRecord {
    return this.getBlockMap().last();
  }

  getPlainText(delimiter?: string): string {
    return this.getBlockMap()
      .map(block => {
        return block ? block.getText() : '';
      })
      .join(delimiter || '\n');
  }

  getLastCreatedEntityKey() {
    // TODO: update this when we fully remove DraftEntity
    return DraftEntity.__getLastCreatedEntityKey();
  }

  hasText(): boolean {
    var blockMap = this.getBlockMap();
    return blockMap.size > 1 || blockMap.first().getLength() > 0;
  }

  createEntity(
    type: DraftEntityType,
    mutability: DraftEntityMutability,
    data?: Object,
  ): ContentState {
    // TODO: update this when we fully remove DraftEntity
    DraftEntity.__create(type, mutability, data);
    return this;
  }

  mergeEntityData(key: string, toMerge: {[key: string]: any}): ContentState {
    // TODO: update this when we fully remove DraftEntity
    DraftEntity.__mergeData(key, toMerge);
    return this;
  }

  replaceEntityData(key: string, newData: {[key: string]: any}): ContentState {
    // TODO: update this when we fully remove DraftEntity
    DraftEntity.__replaceData(key, newData);
    return this;
  }

  addEntity(instance: DraftEntityInstance): ContentState {
    // TODO: update this when we fully remove DraftEntity
    DraftEntity.__add(instance);
    return this;
  }

  getEntity(key: string): DraftEntityInstance {
    // TODO: update this when we fully remove DraftEntity
    return DraftEntity.__get(key);
  }

  static createFromBlockArray(
    // TODO: update flow type when we completely deprecate the old entity API
    blocks: Array<BlockNodeRecord> | {contentBlocks: Array<BlockNodeRecord>},
    entityMap: ?any,
  ): ContentState {
    // TODO: remove this when we completely deprecate the old entity API
    const theBlocks = Array.isArray(blocks) ? blocks : blocks.contentBlocks;
    var blockMap = BlockMapBuilder.createFromArray(theBlocks);
    var selectionState = blockMap.isEmpty()
      ? new SelectionState()
      : SelectionState.createEmpty(blockMap.first().getKey());
    return new ContentState({
      blockMap,
      entityMap: entityMap || DraftEntity,
      selectionBefore: selectionState,
      selectionAfter: selectionState,
    });
  }

  static createFromText(
    text: string,
    delimiter: string | RegExp = /\r\n?|\n/g,
  ): ContentState {
    const strings = text.split(delimiter);
    const blocks = strings.map(block => {
      block = sanitizeDraftText(block);
      return new ContentBlockNodeRecord({
        key: generateRandomKey(),
        text: block,
        type: 'unstyled',
        characterList: List(Repeat(CharacterMetadata.EMPTY, block.length)),
      });
    });
    return ContentState.createFromBlockArray(blocks);
  }
}

module.exports = ContentState;
