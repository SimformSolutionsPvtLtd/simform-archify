# Embedding a diagram in SharePoint

A delivered diagram is one self-contained HTML file: fonts, icons, styles and
scripts are inlined and it makes no network request. That makes it safe to host
anywhere, but it also shapes how SharePoint can show it.

## What works

SharePoint Online does not run custom script in modern pages and does not
reliably render an `.html` file uploaded to a document library (the browser is
asked to download it). So host the HTML file at an `https://` address and show
it in the page's **Embed** web part as an iframe.

1. **Host the file.** Any static HTTPS host works, for example an Azure Storage
   static website, Azure Static Web Apps, or an internal web server.
   Use a stable URL and keep the file name from `meta.output`.
2. **Allow the host to be framed.** The host must not send `X-Frame-Options: DENY`
   or `SAMEORIGIN`, and any `Content-Security-Policy: frame-ancestors` must include
   the SharePoint origin, for example `frame-ancestors 'self' https://<tenant>.sharepoint.com`.
3. **Allow the host in SharePoint.** A site collection admin adds the host under
   *Site settings > HTML Field Security* ("Allow users to embed content from the
   following domains"). Without this the Embed web part refuses the URL.
4. **Add the Embed web part** and paste the iframe (below), or the page URL if
   the host is on SharePoint's own allow list.

Verify the framing headers and the allow-list setting in your tenant: they are
tenant and host policy, not something the diagram file controls.

## Iframe snippet

```html
<iframe src="https://YOUR-HOST/azure-web-platform.html?present=1&theme=light"
        title="Azure web platform architecture"
        width="100%" height="680" style="border:0"
        loading="lazy" allow="fullscreen" allowfullscreen></iframe>
```

## URL parameters the viewer understands

| Parameter | Effect |
| --- | --- |
| `present=1` | Interactive stage that fills the frame: title, diagram, toolbar; cards hidden. Best default for SharePoint. Click nodes, trace routes, use the lens. |
| `theme=light` / `theme=dark` | Force a theme. Light is the Simform default. |
| `embed=1` | Static diagram only: no toolbar, no title, no interaction. Use for a thumbnail-style tile. `embed=1` wins over `present=1`. |

Set the frame height to about 600-720px for a typical architecture; the stage
scales the diagram to fit the frame.

## Notes

- The viewer stores the light/dark choice in `localStorage` inside a try/catch, so
  a sandboxed or third-party-storage-blocked iframe still works; the choice just
  does not persist.
- Export (PNG, SVG, share card) downloads a file. A sandboxed iframe that lacks
  `allow-downloads` blocks that; open the diagram in its own tab to export.
- Nothing in the file calls out to the internet, so a strict SharePoint
  Content Security Policy does not need extra `connect-src`, `font-src` or
  `img-src` entries for the diagram's own content.
- To refresh a diagram, re-run `finalize` and replace the hosted file at the same URL.
