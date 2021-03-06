// @flow
import type {Type, Block} from '../typeDefs'
import {blocksToEditorValue} from '@lyra/block-tools'
import {Value, Operation} from 'slate'
import {applyAll} from '../../../simplePatch'
import findInlineByAnnotationKey from './findInlineByAnnotationKey'

// const VALUE_TO_JSON_OPTS = {
//   preserveData: true,
//   preserveKeys: true,
//   preserveSelection: false,
//   preserveHistory: false
// }

type Path = string | {_key: string}

type Patch = {
  type: string,
  path: Path[]
}

function findLastKey(path: Path[]) {
  let key = null
  path.forEach(part => {
    if (part._key) {
      key = part._key
    }
  })
  return key
}

function setPatch(patch: Patch, change: () => void, type: Type) {
  if (Array.isArray(patch.value)) {
    if (patch.path.length === 0) {
      return replaceValue(patch.value, change, type)
    }
    throw new Error(
      `Invalid patch, looks like it should be an insert: ${JSON.stringify(
        patch
      )}`
    )
  }
  const editorBlock = blocksToEditorValue([patch.value], type).document.nodes[0]
  const key = findLastKey(patch.path)
  return change.replaceNodeByKey(key, editorBlock)
}

function setIfMissingPatch(patch: Patch, change: () => void, type: Type) {
  if (patch.path.length === 0) {
    return replaceValue(patch.value, change, type)
  }
  const doc = change.value.document
  const blockKey = patch.path[0]._key
  const block = doc.nodes.find(node => node.key === blockKey)
  if (block.isVoid) {
    const data = block.data.toObject()
    if (!data.value) {
      const newData = {...data, value: patch.value}
      change.setNodeByKey(blockKey, {data: newData})
    }
  } else {
    throw new Error(
      `Invalid patch, looks like it should be an insert: ${JSON.stringify(
        patch
      )}`
    )
  }
  return change
}

function insertPatch(patch: Patch, change: () => void, type: Type) {
  const {items, position} = patch
  const fragment = blocksToEditorValue(items, type)
  const posKey = findLastKey(patch.path)
  let path = change.value.document.nodes.findIndex(node => {
    return node.key === posKey
  })
  if (position === 'before') {
    path = path > 0 ? path-- : path
  }
  if (position === 'after') {
    path++
  }
  const operations = fragment.document.nodes.map(block => {
    return Operation.create({
      type: 'insert_node',
      path: [path],
      node: block
    })
  })
  change.applyOperations(operations)
  return change
}

function unsetPatch(patch: Patch, change: () => void) {
  const lastKey = findLastKey(patch.path)
  change.removeNodeByKey(lastKey)
  return change
}

function replaceValue(snapshot: ?(Blocks[]), change: () => void, type: Type) {
  if (snapshot) {
    const fragment = blocksToEditorValue(snapshot, type)
    if (change.value.document.nodes.size) {
      change.selectAll().delete()
    }
    change.applyOperations(
      fragment.document.nodes.reverse().map(node => {
        return {
          type: 'insert_node',
          path: [0],
          node: node
        }
      })
    )
    return change
  }
  throw new Error('No snapshot given!')
}

function patchAnnotationData(
  patch: Patch,
  change: () => void,
  type: Type,
  snapshot: Block[]
) {
  const doc = change.value.document
  const blockKey = patch.path[0]._key
  const markDefKey = patch.path[2]._key
  const node = findInlineByAnnotationKey(markDefKey, doc)

  const data = node.data.toObject()
  data.annotations = data.annotations || {}
  const annotationKey = Object.keys(data.annotations).find(
    key => data.annotations[key]._key === markDefKey
  )
  if (!annotationKey) {
    throw new Error('Annotation not found in data')
  }
  // If this is a unset patch, remove the annotation
  if (patch.type === 'unset' && patch.path.length === 3) {
    delete data.annotations[annotationKey]
    // If no more annotations, unwrap the inline
    if (Object.keys(data.annotations).length === 0) {
      return change.unwrapInlineByKey(node.key)
    }
    return change.setNodeByKey(node.key, {data})
  }
  // Annotation is changed, update it's data
  if (snapshot) {
    data.annotations[annotationKey] = snapshot
      .find(blk => blk._key === blockKey)
      .markDefs.find(def => def._key === markDefKey)
  } else {
    const _patch = {...patch}
    _patch.path = patch.path.slice(2)
    const annotation = data.annotations[annotationKey]
    data.annotations[annotationKey] = applyAll([annotation], [_patch])[0]
  }
  return change.setNodeByKey(node.key, {data})
}

function patchBlockData(
  patch: Patch,
  change: () => void,
  type: Type,
  snapshot: Block[]
) {
  const doc = change.value.document
  const blockKey = patch.path[0]._key
  const block = doc.nodes.find(node => node.key === blockKey)
  // Only act on formbuilder blocks
  if (block.isVoid) {
    const data = block.data.toObject()
    // A Saga patch because snapshot, set value from there
    if (snapshot) {
      data.value = snapshot.find(blk => blk._key === blockKey)
    } else {
      // Do a simple formbuilderPatch
      const _patch = {...patch}
      _patch.path = _patch.path.slice(1)
      const newValue = applyAll(data.value, [_patch])
      data.value = newValue
    }
    change.setNodeByKey(block.key, {data})
  }
  return change
}

function patchInlineData(
  patch: Patch,
  change: () => void,
  type: Type,
  snapshot: Block[]
) {
  const doc = change.value.document
  const blockKey = patch.path[0]._key
  const inlineKey = patch.path[2]._key
  const block = doc.nodes.find(node => node.key === blockKey)
  const inline = block.nodes.find(
    node =>
      node.data &&
      node.data.get('value') &&
      node.data.get('value')._key === inlineKey
  )
  const data = inline.data.toObject()
  // A Saga patch because snapshot, set value from there
  if (snapshot) {
    data.value = snapshot
      .find(blk => blk._key === blockKey)
      .children.find(child => child._key === inlineKey)
  } else {
    // Do a simple formbuilderPatch
    const _patch = {...patch}
    _patch.path = _patch.path.slice(3)
    const newValue = applyAll(data.value, [_patch])
    data.value = newValue
  }
  change.setNodeByKey(inline.key, {data})
  return change
}

export default function patchesToChange(
  patches: Patch[],
  editorValue: Value,
  snapshot: ?(Block[]),
  type: Type
) {
  const change = editorValue.change({normalize: false})
  // console.log('EDITORVALUE', JSON.stringify(editorValue.document.toJSON(VALUE_TO_JSON_OPTS), null, 2))
  // console.log('BLOCKS', JSON.stringify(blocks, null, 2))
  patches.forEach((patch: Patch) => {
    // console.log('INCOMING PATCH', JSON.stringify(patch, null, 2))
    if (patch.path.length > 1) {
      if (patch.path[1] === 'markDefs') {
        patchAnnotationData(patch, change, type, snapshot)
      } else if (patch.path[1] === 'children' && patch.path.length > 3) {
        patchInlineData(patch, change, type, snapshot)
      } else {
        patchBlockData(patch, change, type, snapshot)
      }
    } else {
      switch (patch.type) {
        case 'set':
          setPatch(patch, change, type)
          break
        case 'setIfMissing':
          setIfMissingPatch(patch, change, type)
          break
        case 'insert':
          insertPatch(patch, change, type)
          break
        case 'unset':
          unsetPatch(patch, change)
          break
        default:
          replaceValue(snapshot, change, type)
      }
    }
  })
  return change
}
