# PDFdemo

A free, **100% in-your-browser** PDF editor. Upload one or more PDFs and merge,
split, rotate, delete, reorder (drag & drop), and compress them. **Your files
never leave your device** — there is no server, which is what keeps it private
and free to run.

If you refresh the page mid-edit, PDFdemo offers to restore your previous work.

---

## Running it on your own computer

You only need **Node.js** installed (https://nodejs.org — the "LTS" version).

Open a terminal in this folder and run:

```bash
npm install      # once, to download the building blocks
npm run dev      # starts the app for local testing
```

Then open the link it prints (usually http://localhost:5173) in your browser.

To stop it, press `Ctrl + C` in the terminal.

---

## Putting it online (free)

The app is just static files, so any free static host works. First build it:

```bash
npm run build    # creates a "dist" folder with the finished app
```

Then upload the **`dist`** folder to any of these free options:

- **Netlify** – drag-and-drop the `dist` folder at https://app.netlify.com/drop
- **Vercel** – https://vercel.com (connect this project, it auto-builds)
- **GitHub Pages** – push this repo and serve the `dist` folder

Because everything runs in the visitor's browser, there are no running costs.

---

## What's inside (for the curious)

| Piece | What it does |
|-------|--------------|
| React + Vite + TypeScript | The app framework and build tool |
| Tailwind CSS | Styling (the warm, friendly look) |
| pdf-lib | Does the merging, splitting, rotating, deleting, reordering |
| pdf.js | Draws the little page thumbnails you drag around |
| dnd-kit | Smooth drag-to-reorder (works on touch screens too) |
| JSZip | Bundles split files into one `.zip` download |
| idb-keyval | Saves in-progress work in the browser so a refresh recovers it |

### Folder layout

```
src/
  components/   Screen pieces (Header, DropZone, Workspace, PageThumb, Toolbar, …)
  lib/          PDF helpers (pdf-lib editing, pdf.js thumbnails, zip, storage)
  state/        The in-memory "page plan" and its types
  App.tsx       Ties everything together
```

## A note on "Compress"

Compression happens safely in the browser: PDFdemo re-saves the file more
efficiently and strips wasted data. This is lossless (no quality change), but
how much it shrinks **depends heavily on the file** — image-heavy or scanned
PDFs may barely change. PDFdemo always keeps whichever version is smaller and
tells you the before/after size, so it never makes a file bigger.
