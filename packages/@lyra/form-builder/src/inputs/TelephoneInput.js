//@flow
import React from 'react'
import TextInput from 'part:@lyra/components/textinputs/default'
import FormField from 'part:@lyra/components/formfields/default'
import PatchEvent, {set, unset} from '../PatchEvent'
import type {Type, Marker} from '../typedefs'

type Props = {
  type: Type,
  level: number,
  value: ?string,
  readOnly: ?boolean,
  onChange: PatchEvent => void,
  markers: Array<Marker>
}

export default class TelephoneInput extends React.Component<Props> {
  _input: ?TextInput

  handleChange = (event: SyntheticEvent<HTMLInputElement>) => {
    const value = event.currentTarget.value
    this.props.onChange(PatchEvent.from(value ? set(value) : unset()))
  }

  focus() {
    if (this._input) {
      this._input.focus()
    }
  }

  setInput = (input: ?TextInput) => {
    this._input = input
  }

  render() {
    const {value, markers, type, readOnly, level, ...rest} = this.props
    const validation = markers.filter(marker => marker.type === 'validation')
    const errors = validation.filter(marker => marker.level === 'error')

    return (
      <FormField
        markers={markers}
        level={level}
        label={type.title}
        description={type.description}
      >
        <TextInput
          {...rest}
          customValidity={
            errors && errors.length > 0 ? errors[0].item.message : ''
          }
          type="tel"
          value={value}
          readOnly={readOnly}
          placeholder={type.placeholder}
          onChange={this.handleChange}
          ref={this.setInput}
        />
      </FormField>
    )
  }
}
