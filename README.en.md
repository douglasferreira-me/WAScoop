> **Beta (test version).** I am preparing a signed version for the Firefox add-ons store. Installation is temporary for now: follow the guide below. **Google Drive is experimental, in testing, and not publicly available. The Google application is already configured; connect an account registered as a test user. For general use, choose the local ZIP download.**

[Português](README.md) · **English**

<p align="center">
  <img src="docs/branding/logo.png" width="128" alt="Whatsapp Scoop: a smiling chat bubble wearing researcher glasses">
</p>

# Whatsapp Scoop

A tool to **make research easier for communication and media researchers studying the internet**. It collects messages from a WhatsApp group or channel into a spreadsheet and can also download the media. Use it to organize a corpus, analyze content, and document collection methods for academic articles and other research, including studies of disinformation.

Created by **[Douglas Ferreira](https://douglasferreira.me)**. The tool organizes material; researchers perform the analysis and classification.

## Quick summary

This is the **summary**; the full instructions follow below. You do not need programming knowledge.

1. Download and extract the [test package](https://github.com/douglasferreira-me/WAScoop/releases/download/v0.4.4-beta/whatsapp-scoop-0.4.4-temporario.zip).
2. In Firefox, open `about:debugging` → **This Firefox** → **Load Temporary Add-on**, then select `manifest.json` in the extracted folder.
3. Open a group or channel in WhatsApp Web, open the **Whatsapp Scoop** panel, choose **English** at the top, and click **Start collection**. Select **Include media** if you want the files.
4. Save and extract the resulting ZIP. Open `mensagens.csv` as a spreadsheet and keep the other files together. Select the optional XLSX workbook for a more convenient analysis view.

**You must load the extension again after restarting Firefox. Export your collection before closing the browser.**

## Install the test version: step by step

Use **Firefox for desktop, version 140 or later**. You do not need Python or development tools.

1. **Download the package.** Click [whatsapp-scoop-0.4.4-temporario.zip](https://github.com/douglasferreira-me/WAScoop/releases/download/v0.4.4-beta/whatsapp-scoop-0.4.4-temporario.zip). It will usually appear in **Downloads**. Choose this file rather than the source-code package or `.xpi` file.
2. **Extract it.** A ZIP bundles a folder and its contents. On Windows, right-click and choose **Extract All**. On macOS, double-click the ZIP. Keep the extracted folder: you will need it to load the extension again.
3. **Open the installation page.** Click Firefox's address bar at the top of the window, type `about:debugging`, and press **Enter**.
4. **Choose this browser.** Click **This Firefox** on the left, then **Load Temporary Add-on…**. In Portuguese Firefox, these are **Este Firefox** and **Carregar extensão temporária…**.
5. **Choose the extension file.** Open the extracted folder, select **manifest.json**, and click **Open**. This file tells Firefox how to load the extension; you do not need to edit it.
6. **Check the installation.** **Whatsapp Scoop** should appear in the list. It is ready to use.

The temporary installation disappears when Firefox restarts. Repeat steps **3–5** using the same folder. The unsigned `.xpi` does not yet support permanent installation in standard Firefox.

## Collect a conversation: step by step

1. **Open WhatsApp.** Visit [WhatsApp Web](https://web.whatsapp.com) in Firefox and connect your account following its instructions. Reload the tab if it was already open when you installed the extension.
2. **Choose a conversation.** Open the group or channel you want to study. Each collection covers **one conversation at a time**, using the history accessible to your account.
3. **Open the panel.** Click **Whatsapp Scoop** in the Firefox toolbar. If you cannot see it, look under the puzzle-piece **Extensions** button. Choose **English** under **Idioma / Language** at the top, then click **Refresh** and check the conversation name.
4. **Choose dates.** Enter a start and end date for a specific period. Leave both empty to retrieve all accessible history.
5. **Choose media.** Select **Include media** to download available photos, videos, audio, documents, and stickers. Leave it unchecked for messages and metadata only. Media require more time and storage.
6. **Choose the workbook.** Select **Include analysis workbook (XLSX)** for a summary, filters, and easier viewing. It is optional and off by default: **it can increase export time**, particularly for large collections. The CSV is always included.
7. **Choose identification settings.** **Pseudonymize senders** replaces names and numbers in identification fields. It does not remove personal information from message text or images.
8. **Start.** Keep **Download a ZIP to this computer** as the destination and click **Start collection**. Keep the tab open and avoid navigating within the conversation while collection runs.
9. **Watch progress.** The panel shows the current phase, message count, dates reached, and media results. There is no completion percentage because the total accessible history is unknown.
10. **Save the result.** Firefox offers the ZIP download when collection ends. Choose where to save it. To finish early, click **Stop and export** to receive the material collected so far.

Use **Pause** and **Resume** to pause and continue. The tool tracks scrolling and attempts recovery before pausing. **Resume** restarts those attempts. An observed history boundary requires repeated attempts without progress at the top and no loading indicator. If you switch conversations, return to the original to resume. If you close or reload the tab, export the partial collection and start a new one. Use **Export ZIP** to retry a download.

### Open and understand the files

Extract the collection ZIP as you did with the installation package. **Keep the entire folder together**: the spreadsheet references its media files. Exported filenames, column names, and worksheet names remain in Portuguese regardless of panel language.

| Content | How to use it |
| --- | --- |
| `workbook.xlsx` | Optional: included when **Include analysis workbook (XLSX)** is selected. Contains **Resumo** (Summary), **Mensagens** (Messages), and **Mídias** (Media), with filters, frozen headers, and alternating row colors. |
| `mensagens.csv` | The same message data in a simple format for importing into analysis software. |
| `midias/` | Recovered media, when requested. |
| `.system/indice_midias.json` | Associates files with messages and records format, size, and verification hashes. |
| `.system/relatorio_coleta.json` | Records the version, period, counts, failures, and interruptions. Keep it to document your methodology. |

**If you selected XLSX, open `workbook.xlsx` in Excel or LibreOffice.** In **Mensagens**, use header filters for sender, type, date, or interactions. Dates use UTC and counts are numeric. The summary records the collection and does not change when you filter. When necessary, very long fields are preserved in numbered parts in **Textos longos** (Long texts).

The extension attempts to recover dates, text, and captions through your WhatsApp session when they are missing from the interface. After automatic retries, collection continues with explicit missing-field flags: `status_captura` indicates incomplete records, and `campos_ausentes` lists missing fields. The panel and report show these issues. Further recovery attempts update records without duplication. Media without captions can have empty text; empty interface containers are not counted and are recorded in the report. Messages without recognized dates appear at the end of the CSV.

**Counting messages:** one CSV record represents one message. The header is not a message, and a message can contain line breaks within one cell. Counting lines in a text editor can therefore exceed the panel's message count.

The `.system` folder contains technical files and may be hidden. Key information is also available in **Resumo** when XLSX is selected. On Windows, enable **View → Hidden items** in File Explorer; on macOS, press **⌘ + Shift + .** in Finder.

For other programs, open `mensagens.csv` in Excel or LibreOffice, or import it into Google Sheets. If everything appears in one column or characters look wrong, use **Import text/CSV**, **UTF-8** encoding, and a **comma** separator.

- **Media:** `midias_ids` identifies files such as `MID-000001`; `midias` gives paths such as `midias/MID-000001.png`. Multiple entries follow the same order in both columns, separated by ` | `.
- **Message permalink:** `link_mensagem` records a channel post's permanent address when available. It is distinct from a channel invitation. The field stays empty without a confirmed channel code and post identifier; group permalinks are not invented. Run a new collection to obtain this field.
- **Links:** `links` records URLs found in messages without opening their websites. Link previews do not substitute for directly posted media.
- **Interactions:** `interacoes_total` records the observed reaction count. `interacoes_precisao` indicates whether it is exact, approximate, or unavailable. An empty value does not mean zero. Counts can change after collection.

**Panel language:** choose **Português** or **English** under **Idioma / Language** at the top. Your choice is saved in this browser and can be changed during collection. Message content and exported column names are preserved.

### Listen for new messages only

1. Open a channel and select **Listen for new channel messages**. Media are included automatically; earlier history is excluded.
2. Choose **Download a ZIP to this computer** for manual export after pausing or stopping. **Google Drive** is experimental and restricted to registered test users. The Google application is already configured: click **Connect to Google Drive** and choose your account.
3. Click **Start collection** and keep the channel loaded in the WhatsApp tab. **You can use other tabs normally** without selecting WhatsApp. The panel shows messages, media, local storage, and pending uploads. Closing the panel does not stop collection.
4. On Drive, one folder holds media and **one `mensagens.csv`**, updated about once a minute when changes occur. **Sync now** requests an earlier update. If you select **Include analysis workbook (XLSX)** before starting, the same `workbook.xlsx` is also updated automatically. Generating it can slow synchronization. CSV and XLSX are files in Drive, rather than a native Google Sheets spreadsheet.

Messages are stored on disk in Firefox, without keeping the entire corpus in memory. The default local media limit is **512 MB**, adjustable before starting. **Release local copies after Drive confirms upload** reduces storage use, but the ZIP then contains references to released media on Drive. Leave it unchecked to retain local copies for a complete ZIP. Individual files over 256 MB pause listening.

If the network or Google authorization fails, the upload queue remains local; capture pauses when storage reaches its limit. Reconnect, click **Sync now**, then **Resume**. If retained local copies fill the limit, stop and export before starting another collection. **Listening requires the browser and computer to remain running, with WhatsApp loaded on the chosen channel.** Closing, reloading, or discarding that tab, suspending the computer, or losing the session can leave gaps. Firefox may slow background checks; instant updates are not guaranteed. Reaction updates cover only recent messages still loaded.

### Google Drive: experimental and restricted to testing

**Google Drive integration is not yet available to the general public.** The Google application remains in **Testing**, allowing only accounts added by the maintainer as **Test users**. Installing the extension does not authorize every Google account.

Upload code is implemented, but **login, redirection, and upload to a real Google account still need validation**. The public Client ID is already included: researchers do not need to create a Google project or copy credentials. Simply connect an authorized account. Local ZIP export needs no Google login. The [maintainer and fork guide](docs/GOOGLE_DRIVE.md) (in Portuguese) explains application configuration and the optional ID override under **Advanced settings · Google and forks**, including **Restore extension default**. Never enter a password or client secret in the extension.

Public availability depends on validating login and meeting Google's requirements. Firefox signing and store publication are a separate process.

Access is limited to application files (`drive.file`). Tokens remain in memory for the session. The legacy login flow may require reconnection; see the guide for limitations. Local ZIP export works without Google configuration.

## If something goes wrong

| Problem | What to do |
| --- | --- |
| The conversation does not appear | Open it in WhatsApp Web, reload the page, and click **Refresh**. |
| **Start collection** is disabled | The previous collection is active or paused. **Resume** in the original conversation or **Stop and export** before starting another. |
| A media file failed | Check the report: the file may be unavailable or the integration may need adjustment. |
| The ZIP did not download | Retry **Export ZIP**. For very large collections, use smaller date ranges. |
| I need to report an error | Click **Download diagnostic log** and attach the file when asking for help. If that download also fails, use **View or copy log**. |

You can download the log **even when everything works**. It records phases, counts, and errors without message text, conversation names, or credentials. It is not sent automatically. After a restart, you can try **Restore last collection** under **Temporary data**, but do not rely on recovery after removing the extension.

## Using the tool in research

Collection covers what WhatsApp makes accessible to your account. **Reaching the scrolling boundary does not prove that all history was recovered.** Expired or deleted files cannot be reconstructed; failures are recorded. Changes to WhatsApp can affect the extension.

Check a sample of messages and media before analyzing the corpus. Recognized dates use ISO format in UTC; `data_original` preserves the observed information. Unknown fields remain empty. Messages without recognized dates are excluded when a date filter is active. Review personal data before sharing material or publishing examples.

In your methodology, record the version from the report, collection date, requested period, and observed limitations. Suggested citation: **Douglas Ferreira. Whatsapp Scoop, version [version in report]. Available at https://github.com/douglasferreira-me/WAScoop. Data collected on [date].** See also [privacy and permissions](docs/PRIVACIDADE.md) and [validation status](docs/VALIDACAO.md), both in Portuguese.

## Development and forks

The extension uses JavaScript, HTML, and CSS to run in Firefox without a helper program; Python builds the packages. Collection combines scrolling and page reading with media downloads through the connected session using WA-JS.

The [technical guide](docs/DESENVOLVIMENTO.md) (in Portuguese) covers setup, code organization, tests, packaging, and distribution. The project uses **GPL-3.0**, with separate licenses for bundled libraries.

## Partnerships

In partnership with [Condado Lab](https://condadolab.org) and [OASIS — UFRJ](https://oasisufrj.org).

<table>
  <tr>
    <td align="center" width="200">
      <a href="https://condadolab.org"><img src="docs/branding/partners/condado-lab-symbol.png" width="64" height="64" alt="Condado Lab"></a><br>
      <a href="https://condadolab.org">Condado Lab</a>
    </td>
    <td align="center" width="200">
      <a href="https://oasisufrj.org">
        <picture>
          <source media="(prefers-color-scheme: dark)" srcset="docs/branding/partners/oasis-dark.png">
          <img src="docs/branding/partners/oasis-light.png" width="160" alt="OASIS — UFRJ">
        </picture>
      </a><br>
      <a href="https://oasisufrj.org">OASIS — UFRJ</a>
    </td>
  </tr>
</table>
