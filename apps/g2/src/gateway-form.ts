export interface GatewayFormState {
  gatewayUrlDraft: string | null
}

export function initialGatewayFormState(): GatewayFormState {
  return { gatewayUrlDraft: null }
}

export function captureGatewayUrlDraft(
  state: GatewayFormState,
  gatewayUrl: string,
): GatewayFormState {
  return state.gatewayUrlDraft === gatewayUrl ? state : { gatewayUrlDraft: gatewayUrl }
}

export function commitGatewayUrlDraft(
  state: GatewayFormState,
  gatewayUrl: string,
): GatewayFormState {
  return captureGatewayUrlDraft(state, gatewayUrl)
}

export function gatewayUrlInputValue(
  state: GatewayFormState,
  savedGatewayUrl: string | null,
): string {
  return state.gatewayUrlDraft ?? savedGatewayUrl ?? ''
}

export function shouldDisableGatewaySave(storageReady: boolean, saveInFlight: boolean): boolean {
  return !storageReady || saveInFlight
}
