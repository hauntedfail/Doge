# Reader guide

Doge starts with a choice of Home, Following or Bookmarks. Select a feed to
begin reading.

## Controls

| Context            | Input      | Action                                                                  |
| ------------------ | ---------- | ----------------------------------------------------------------------- |
| Feed selector      | Scroll     | Select Home, Following or Bookmarks                                     |
| Feed selector      | Tap        | Open the selected feed                                                  |
| Feed selector      | Double tap | Exit Doge                                                               |
| Post               | Swipe down | Scroll forwards; at the boundary, advance to the next chunk or post     |
| Post               | Swipe up   | Scroll backwards; at the boundary, return to the previous chunk or post |
| Post               | Tap        | Open the action menu                                                    |
| Timeline           | Double tap | Return to the feed selector                                             |
| Thread             | Double tap | Return to the previous reader view                                      |
| Action menu        | Scroll     | Select an action                                                        |
| Action menu        | Tap        | Run the selected action                                                 |
| Action menu        | Double tap | Close the menu                                                          |
| Gallery or profile | Double tap | Return to the reader                                                    |

Post navigation follows the finger's direction: down advances and up goes back.
It does not drag the content as a phone's natural scrolling would. The feed
selector and action menu use native G2 list scrolling.

The action menu offers Like, Repost and Bookmark, with the corresponding undo
action when active, followed by Gallery when images are available, Reload,
Open thread, Profile and Close. Within a thread, Open thread becomes Close
thread. A successful reaction closes the menu.

## Text and images

Long posts use the G2 firmware's native text-container overflow scrolling,
without redrawing the text one line at a time. Text is split into chunks of at
most 2,000 UTF-16 code units without truncation or splitting surrogate pairs.
When creating or rebuilding a layout, Doge first supplies a prefix within the
1,000-code-unit creation limit, then upgrades the container to the full chunk.

For posts spanning multiple frames, the bottom-left indicator shows the current
chunk or media-frame position; the bottom-right indicator shows the post's
position in the timeline. The display reserves its space for content rather
than a permanent control guide. Physical scrolling and boundary transitions
still require the checks listed in [`Backlog.md`](../Backlog.md).

Posts with images show one to four images in an aspect-ratio-preserving grid at
the end of the post. The final text lines share a frame with the image grid;
earlier text stays in scrollable chunks. Shorter text leaves more room for
images. Each image has its own loading placeholder. Gallery provides a
separate, larger image view.

Videos and animated GIFs use still posters with a play indicator. Doge does not
fetch or play video streams.

Fetched media blobs and converted PNG tiles are held briefly in bounded
least-recently-used WebView memory caches. Revisiting an image can avoid another
download, decode and conversion. The current bridge path still sends image
bytes again after a page rebuild. Icons, avatars and post images are sent
sequentially as encoded PNG or JPEG bytes; stale avatar results are discarded
when the reader moves on.

## Gateway pairing

Public builds have no preset gateway. In the phone companion, enter your
gateway's HTTPS origin and 43-character access key, then select
**Save and test connection**. Local desktop development also accepts loopback
HTTP addresses.

Doge calls `GET /api/v1/session` with the bearer key and checks the
[protocol identity](gateway-protocol.md#pairing-handshake). It saves the pairing
only after validation succeeds. No timeline or media requests are sent before
pairing.

The Even SDK's device storage keeps the URL and access key. Doge verifies that
the saved key can be read back before treating the connection as ready. At
startup, settings controls remain disabled until storage restoration completes;
the saved pairing is then checked again without requiring re-entry.

- The URL draft is stored separately, so it survives a failed connection or a
  restart.
- Leave the key field blank to retain the saved key. **Saved access key is
  active** means it remains available even though the password field is empty.
- Enter a new key only when replacing the saved one.
- **Forget access key** removes the key and leaves the URL in the form.
- Earlier WebView and legacy pairing values are migrated to device storage.

## App icon

[`doge-icon.png`](../apps/g2/public/doge-icon.png) is used for the phone web app
and the initial loading screen after feed selection. Upload the same image
manually when setting the Even Hub listing icon. Its origin and terms are
documented in the [asset licence](../apps/g2/public/doge-icon.LICENSE.md).
