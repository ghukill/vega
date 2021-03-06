// @flow
/* eslint-disable complexity */

import type {
  BlockContentFeatures,
  SlateValue,
  SlateChange,
  Type
} from '../typeDefs'

import React from 'react'
import classnames from 'classnames'
import enhanceWithClickOutside from 'react-click-outside'

import {ContainerQuery} from 'react-container-query'
import {Tooltip} from 'react-tippy'

import ArrowIcon from 'part:@lyra/base/angle-down-icon'
import Button from 'part:@lyra/components/buttons/default'
import ChevronDown from 'part:@lyra/base/chevron-down-icon'
import CloseIcon from 'part:@lyra/base/close-icon'
import FullscreenIcon from 'part:@lyra/base/fullscreen-icon'
import ValidationList from 'part:@lyra/components/validation/list'
import WarningIcon from 'part:@lyra/base/warning-icon'

import AnnotationButtons from './AnnotationButtons'
import BlockStyleSelect from './BlockStyleSelect'
import DecoratorButtons from './DecoratorButtons'
import InsertMenu from './InsertMenu'
import ListItemButtons from './ListItemButtons'

import IS_MAC from '../utils/isMac'

import styles from './styles/Toolbar.css'

type Props = {
  blockContentFeatures: BlockContentFeatures,
  editorValue: SlateValue,
  focusPath: [],
  fullscreen: boolean,
  onChange: (change: SlateChange) => void,
  onFocus: (nextPath: []) => void,
  onToggleFullScreen: void => void,
  markers: [],
  style: {},
  type: Type
}

type State = {
  expanded: boolean,
  showValidationTooltip: boolean
}

const query = {
  [styles.largeContainer]: {
    minWidth: 600
  }
}

class Toolbar extends React.PureComponent<Props, State> {
  state = {
    expanded: false,
    showValidationTooltip: false
  }

  handleExpand = () => {
    this.setState({
      expanded: true
    })
  }

  handleContract = () => {
    this.setState({
      expanded: false
    })
  }

  handleClickOutside = () => {
    this.setState({
      expanded: false
    })
  }

  handleFocus = (focusPath: []) => {
    const {onFocus} = this.props
    onFocus(focusPath)
  }

  handleCloseValidationResults = () => {
    this.setState({showValidationTooltip: false})
  }

  handleToggleValidationResults = () => {
    this.setState(prevState => ({
      showValidationTooltip: !prevState.showValidationTooltip
    }))
  }

  render() {
    const {
      blockContentFeatures,
      editorValue,
      focusPath,
      fullscreen,
      markers,
      onChange,
      onFocus,
      onToggleFullScreen,
      style,
      type
    } = this.props

    const {expanded, showValidationTooltip} = this.state

    const insertItems = blockContentFeatures.types.inlineObjects.concat(
      blockContentFeatures.types.blockObjects
    )

    const validation = markers.filter(marker => marker.type === 'validation')
    const errors = validation.filter(marker => marker.level === 'error')
    const warnings = validation.filter(marker => marker.level === 'warning')

    return (
      <ContainerQuery query={query}>
        {params => (
          <div
            className={`
              ${styles.root}
              ${classnames(params)}
              ${fullscreen ? ` ${styles.fullscreen}` : ''}
            `}
            style={style}
          >
            <div className={styles.primary}>
              <div
                className={styles.blockFormatContainer}
                onClick={this.handleContract}
              >
                <BlockStyleSelect
                  blockContentFeatures={blockContentFeatures}
                  editorValue={editorValue}
                  onChange={onChange}
                />
              </div>
              <Button
                className={styles.expandButton}
                onClick={this.handleExpand}
                kind="simple"
              >
                More&nbsp;
                <span className={styles.arrow}>
                  <ArrowIcon color="inherit" />
                </span>
              </Button>
              <div
                className={`${styles.compactable} ${
                  expanded ? styles.expanded : ''
                }`}
              >
                {blockContentFeatures.decorators.length > 0 && (
                  <div className={styles.decoratorButtonsContainer}>
                    <DecoratorButtons
                      blockContentFeatures={blockContentFeatures}
                      editorValue={editorValue}
                      onChange={onChange}
                    />
                  </div>
                )}
                {blockContentFeatures.lists.length > 0 && (
                  <div className={styles.decoratorButtonsContainer}>
                    <ListItemButtons
                      blockContentFeatures={blockContentFeatures}
                      editorValue={editorValue}
                      onChange={onChange}
                    />
                  </div>
                )}
                {blockContentFeatures.annotations.length > 0 && (
                  <div className={styles.annotationButtonsContainer}>
                    <AnnotationButtons
                      blockContentFeatures={blockContentFeatures}
                      editorValue={editorValue}
                      focusPath={focusPath}
                      onChange={onChange}
                      onFocus={onFocus}
                    />
                  </div>
                )}
                {insertItems.length > 0 && (
                  <div className={styles.insertContainer}>
                    <InsertMenu
                      blockTypes={blockContentFeatures.types.blockObjects}
                      editorValue={editorValue}
                      inlineTypes={blockContentFeatures.types.inlineObjects}
                      onChange={onChange}
                      onFocus={onFocus}
                      type={type}
                    />
                  </div>
                )}
              </div>
            </div>
            <div className={styles.secondary}>
              {fullscreen &&
                (errors.length > 0 || warnings.length > 0) && (
                  <Tooltip
                    arrow
                    duration={100}
                    html={
                      <ValidationList
                        markers={validation}
                        showLink
                        isOpen={showValidationTooltip}
                        documentType={type}
                        onClose={this.handleCloseValidationResults}
                        onFocus={this.handleFocus}
                      />
                    }
                    interactive
                    onRequestClose={this.handleCloseValidationResults}
                    open={showValidationTooltip}
                    position="bottom"
                    style={{padding: 0}}
                    theme="light noPadding"
                    trigger="click"
                  >
                    <Button
                      color="danger"
                      icon={WarningIcon}
                      kind="simple"
                      onClick={this.handleToggleValidationResults}
                      padding="small"
                    >
                      {errors.length}
                      <span style={{paddingLeft: '0.5em'}}>
                        <ChevronDown />
                      </span>
                    </Button>
                  </Tooltip>
                )}
              <div
                className={styles.fullscreenButtonContainer}
                onClick={this.handleContract}
              >
                <Button
                  kind="simple"
                  onClick={onToggleFullScreen}
                  title={`Open in fullscreen (${
                    IS_MAC ? 'cmd' : 'ctrl'
                  }+enter)`}
                  icon={fullscreen ? CloseIcon : FullscreenIcon}
                />
              </div>
            </div>
          </div>
        )}
      </ContainerQuery>
    )
  }
}

export default enhanceWithClickOutside(Toolbar)
