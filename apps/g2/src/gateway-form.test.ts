import { describe, expect, it } from 'vitest'
import {
  captureGatewayUrlDraft,
  commitGatewayUrlDraft,
  gatewayUrlInputValue,
  initialGatewayFormState,
} from './gateway-form.js'

describe('Gateway URL form state', () => {
  it('keeps the entered URL visible when connection testing fails', () => {
    const entered = captureGatewayUrlDraft(initialGatewayFormState(), 'https://unavailable.example')

    expect(gatewayUrlInputValue(entered, null)).toBe('https://unavailable.example')
  })

  it('shows a restored saved URL until the user edits it', () => {
    const initial = initialGatewayFormState()

    expect(gatewayUrlInputValue(initial, 'https://saved.example')).toBe('https://saved.example')
    expect(gatewayUrlInputValue(captureGatewayUrlDraft(initial, ''), 'https://saved.example')).toBe(
      '',
    )
  })

  it('uses the normalised URL after a successful save', () => {
    const entered = captureGatewayUrlDraft(initialGatewayFormState(), 'https://doge.example/')
    const committed = commitGatewayUrlDraft(entered, 'https://doge.example')

    expect(gatewayUrlInputValue(committed, null)).toBe('https://doge.example')
  })
})
