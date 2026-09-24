import { useId } from 'react'
import type { NoteColorTheme, NotePattern } from '../types'
import { NOTE_COLORS, NOTE_PATTERNS } from '../domain/constants'
import { useI18n, type TranslationKey } from '../i18n'

interface PickerProps<T extends string> {
  label: string
  value: T | undefined
  onChange: (value: T) => void
  /** Look of every swatch that isn't the option itself. */
  preview: { color: NoteColorTheme; pattern: NotePattern }
}

/**
 * Swatches built on native radio buttons: arrow keys, focus and screen readers
 * work out of the box.
 */
function SwatchPicker<T extends NoteColorTheme | NotePattern>({
  label,
  options,
  value,
  onChange,
  swatchClass,
  optionLabel,
}: {
  label: string
  options: readonly T[]
  value: T | undefined
  onChange: (value: T) => void
  swatchClass: (option: T) => string
  optionLabel: (option: T) => string
}) {
  const name = useId()

  return (
    <fieldset className="swatch-picker">
      <legend className="field__label">{label}</legend>

      <div className="swatch-picker__options">
        {options.map((option) => (
          <label key={option} className="swatch-picker__option" title={optionLabel(option)}>
            <input
              type="radio"
              className="visually-hidden"
              name={name}
              value={option}
              checked={value === option}
              onChange={() => onChange(option)}
            />

            <span className={`swatch ${swatchClass(option)}`} aria-hidden="true" />

            <span className="visually-hidden">{optionLabel(option)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

const colorKey = (color: NoteColorTheme) =>
  `color${color[0].toUpperCase()}${color.slice(1)}` as TranslationKey

const patternKey = (pattern: NotePattern) =>
  `pattern${pattern[0].toUpperCase()}${pattern.slice(1)}` as TranslationKey

export function ColorPicker({ label, value, onChange, preview }: PickerProps<NoteColorTheme>) {
  const { t } = useI18n()

  return (
    <SwatchPicker
      label={label}
      options={NOTE_COLORS}
      value={value}
      onChange={onChange}
      swatchClass={(color) => `note-color-${color} note-pattern-${preview.pattern}`}
      optionLabel={(color) => t(colorKey(color))}
    />
  )
}

export function PatternPicker({ label, value, onChange, preview }: PickerProps<NotePattern>) {
  const { t } = useI18n()

  return (
    <SwatchPicker
      label={label}
      options={NOTE_PATTERNS}
      value={value}
      onChange={onChange}
      swatchClass={(pattern) => `note-color-${preview.color} note-pattern-${pattern}`}
      optionLabel={(pattern) => t(patternKey(pattern))}
    />
  )
}
