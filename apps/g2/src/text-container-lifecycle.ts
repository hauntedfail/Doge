import { TextContainerProperty } from '@evenrealities/even_hub_sdk'

export const REBUILD_TEXT_CONTENT_MAX_CHARACTERS = 1000
export const TEXT_CONTAINER_UPGRADE_MAX_CHARACTERS = 2000

function rebuildSafePrefix(content: string): string {
  if (content.length <= REBUILD_TEXT_CONTENT_MAX_CHARACTERS) return content
  let end = REBUILD_TEXT_CONTENT_MAX_CHARACTERS
  const finalCodeUnit = content.charCodeAt(end - 1)
  if (finalCodeUnit >= 0xd800 && finalCodeUnit <= 0xdbff) end -= 1
  return content.slice(0, end)
}

export function prepareTextContainersForRebuild(
  containers: readonly TextContainerProperty[],
): TextContainerProperty[] {
  return containers.map((container) => {
    const content = container.content ?? ''
    const safeContent = rebuildSafePrefix(content)
    if (safeContent === content) return container
    return new TextContainerProperty({ ...container, content: safeContent })
  })
}

export function textContainersRequiringHydration(
  desired: readonly TextContainerProperty[],
  rebuilt: readonly TextContainerProperty[],
): TextContainerProperty[] {
  return desired.filter((container, index) => container.content !== rebuilt[index]?.content)
}
