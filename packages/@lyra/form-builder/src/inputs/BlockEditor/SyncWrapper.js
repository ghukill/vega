// @flow

import type {Block, BlockArrayType, SlateValue, Marker} from './typeDefs'

import React from 'react'
import generateHelpUrl from '@lyra/generate-help-url'
import {uniq} from 'lodash'
import FormField from 'part:@lyra/components/formfields/default'
import withPatchSubscriber from '../../utils/withPatchSubscriber'
import {PatchEvent} from '../../PatchEvent'
import InvalidValueInput from '../InvalidValueInput'
import {resolveTypeName} from '../../utils/resolveTypeName'
import Input from './Input'

import createSelectionOperation from './utils/createSelectionOperation'
import changeToPatches from './utils/changeToPatches'
import deserialize from './utils/deserialize'
import patchesToChange from './utils/patchesToChange'

import styles from './styles/SyncWrapper.css'

function findBlockType(type) {
  return type.of.find(ofType => ofType.name === 'block')
}

function isDeprecatedBlockSchema(type) {
  const blockType = findBlockType(type)
  if (blockType.span !== undefined) {
    return 'deprecatedSpan'
  }
  if (
    type.of.find(memberType => memberType.options && memberType.options.inline)
  ) {
    return 'deprecatedInline'
  }
  return false
}

function isDeprecatedBlockValue(value) {
  if (!value || !Array.isArray(value)) {
    return false
  }
  const block = value.find(item => item._type === 'block')
  if (block && Object.keys(block).includes('spans')) {
    return true
  }
  return false
}

function isInvalidBlockValue(value) {
  if (Array.isArray(value)) {
    return false
  }
  if (typeof value === 'undefined') {
    return false
  }
  return true
}

type Props = {
  focusPath: [],
  markers: Marker[],
  onBlur: (nextPath: []) => void,
  onChange: PatchEvent => void,
  onFocus: (nextPath: []) => void,
  onPaste?: (
    event: SyntheticEvent,
    path: [],
    type: Type,
    value: ?Value
  ) => {insert?: Value, path?: []},
  onPatch: (event: PatchEvent) => void,
  readOnly?: boolean,
  renderBlockActions?: (block: Block) => React.Node,
  renderCustomMarkers?: (Marker[]) => React.Node,
  schema: Schema,
  subscribe: (() => void) => void,
  type: BlockArrayType,
  value: Block[]
}

type State = {
  deprecatedSchema: boolean,
  deprecatedBlockValue: boolean,
  invalidBlockValue: boolean,
  editorValue: SlateValue,
  initialFocusPath?: []
}

export default withPatchSubscriber(
  class SyncWrapper extends React.PureComponent<Props, State> {
    _input = null
    _select = null
    _undoRedoStack = {undo: [], redo: []}

    static defaultProps = {
      markers: []
    }

    // Keep track of what the editor value is (as seen in the editor) before it is changed by something.
    _beforeChangeEditorValue = null

    constructor(props) {
      super(props)
      const {value, type} = props
      const deprecatedSchema = isDeprecatedBlockSchema(type)
      const deprecatedBlockValue = isDeprecatedBlockValue(value)
      const invalidBlockValue = isInvalidBlockValue(value)
      this.state = {
        deprecatedSchema,
        deprecatedBlockValue,
        invalidBlockValue,
        initialFocusPath: props.focusPath,
        editorValue:
          deprecatedSchema || deprecatedBlockValue || invalidBlockValue
            ? deserialize([], type)
            : deserialize(value, type)
      }
      this.unsubscribe = props.subscribe(this.handleDocumentPatches)
    }

    componentDidMount() {
      if (this.state.initialFocusPath) {
        setTimeout(() => {
          this.props.onFocus(this.state.initialFocusPath)
        }, 0)
      }
    }

    handleEditorChange = (change: SlateChange, callback: void => void) => {
      const {value, onChange, type} = this.props
      this._beforeChangeEditorValue = this.state.editorValue
      this.setState({editorValue: change.value})

      const patches = changeToPatches(
        this._beforeChangeEditorValue,
        change,
        value,
        type
      )
      this._select = createSelectionOperation(change)

      // Do the change
      if (patches.length) {
        onChange(PatchEvent.from(patches))
      }

      if (callback) {
        callback(change)
        return change
      }
      return change
    }

    handleFormBuilderPatch = (event: PatchEvent) => {
      const {onChange, type} = this.props
      const {editorValue} = this.state
      const change = patchesToChange(event.patches, editorValue, null, type)
      this.setState({editorValue: change.value})
      return onChange(event)
    }

    focus() {
      if (this._input) {
        this._input.focus()
      }
    }

    // eslint-disable-next-line complexity
    handleDocumentPatches = ({patches, shouldReset, snapshot}) => {
      const {type, focusPath} = this.props
      const hasRemotePatches = patches.some(patch => patch.origin === 'remote')
      const hasInsertUnsetPatches = patches.some(patch =>
        ['insert', 'unset'].includes(patch.type)
      )
      const hasMultipleDestinations =
        uniq(
          patches
            .map(patch => patch.path[0] && patch.path[0]._key)
            .filter(Boolean)
        ).length > 1
      const hasComplexity = patches.length > 3
      // Some heuristics for when we should set a new state or just trust that the editor
      // state is in sync with the formbuilder value. As setting a new state may be a performance
      // hog, we don't want to do it for the most basic changes (like entering a new character).
      // TODO: force sync the state every now and then just to be 100% sure we are in sync.
      const shouldSetNewState =
        hasRemotePatches ||
        hasInsertUnsetPatches ||
        hasMultipleDestinations ||
        hasComplexity ||
        shouldReset
      const localPatches = patches.filter(patch => patch.origin === 'local')

      // Handle undo/redo
      if (localPatches.length) {
        const lastPatch = localPatches.slice(-1)[0]
        // Until the FormBuilder can support some kind of patch tagging,
        // we create a void patch with key 'undoRedoVoidPatch' in changesToPatches
        // to know if this is undo/redo operation or not.
        const isUndoRedoPatch =
          lastPatch &&
          lastPatch.path[0] &&
          lastPatch.path[0]._key === 'undoRedoVoidPatch'
        if (!isUndoRedoPatch) {
          this._undoRedoStack.undo.push({
            patches: localPatches,
            // Use the _beforeChangeEditorValue here, because at this point we could be
            // in the middle of changes, and the state.editorValue may be in a flux state
            editorValue: this._beforeChangeEditorValue,
            select: this._select
          })
          // Redo stack must be reset here
          this._undoRedoStack.redo = []
        }
      }

      // Set a new editorValue from the snapshot,
      // and restore the user's selection
      if (snapshot && shouldSetNewState) {
        const editorValue = deserialize(snapshot, type)
        const change = editorValue.change()
        if (this._select) {
          // eslint-disable-next-line max-depth
          try {
            change.applyOperations([this._select])
          } catch (err) {
            // eslint-disable-next-line max-depth
            if (!err.message.match('Could not find a descendant')) {
              console.error(err) // eslint-disable-line no-console
            }
          }
        }
        // Keep the editor focused as we insert the new value
        if ((focusPath || []).length === 1) {
          change.focus()
        }
        this.setState({editorValue: change.value})
      }
    }

    componentWillUnmount() {
      this.unsubscribe()
    }

    refInput = (input: Input) => {
      this._input = input
    }

    handleInvalidValue = () => {}

    // eslint-disable-next-line complexity
    render() {
      const {
        editorValue,
        deprecatedSchema,
        deprecatedBlockValue,
        invalidBlockValue
      } = this.state
      const {onChange, ...rest} = this.props
      const {type, value} = this.props
      const isDeprecated = deprecatedSchema || deprecatedBlockValue
      return (
        <div className={styles.root}>
          {!isDeprecated &&
            !invalidBlockValue && (
              <Input
                editorValue={editorValue}
                onChange={this.handleEditorChange}
                onPatch={this.handleFormBuilderPatch}
                undoRedoStack={this._undoRedoStack}
                ref={this.refInput}
                {...rest}
              />
            )}

          {invalidBlockValue && (
            <InvalidValueInput
              validTypes={type.of.map(mType => mType.name)}
              actualType={resolveTypeName(value)}
              value={value}
              onChange={this.handleInvalidValue}
            />
          )}

          {isDeprecated && (
            <FormField label={type.title}>
              <div className={styles.disabledEditor}>
                <strong>Heads up!</strong>
                <p>
                  You&apos;re using a new version of the Studio with
                  {deprecatedSchema &&
                    " a block schema that hasn't been updated."}
                  {deprecatedSchema &&
                    deprecatedBlockValue &&
                    ' Also block text needs to be updated.'}
                  {deprecatedBlockValue &&
                    !deprecatedSchema &&
                    " block text that hasn't been updated."}
                </p>
                {deprecatedSchema === 'deprecatedInline' && (
                  <p>
                    <a
                      href={generateHelpUrl('migrate-to-block-inline-types')}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      Migrate schema to block.children inline types
                    </a>
                  </p>
                )}
                {deprecatedSchema === 'deprecatedSpan' && (
                  <p>
                    <a
                      href={generateHelpUrl('migrate-to-block-children')}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      Migrate schema to block.children
                    </a>
                  </p>
                )}
              </div>
            </FormField>
          )}
        </div>
      )
    }
  }
)
