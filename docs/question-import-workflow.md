# Question Import Workflow

Use this when a new Excel workbook has candidate flashcards.

## 1. Convert Excel rows to review JSON

```bash
npm run questions:from-excel -- /path/to/questions.xlsx
```

This writes:

```text
content/imports/<batch-id>/questions.generated.json
```

Rows are not uploaded at this stage. The generated JSON keeps:

- normalized question fields
- `selected` from the Excel `use_this` column
- stable `source_fingerprint` values for duplicate detection
- editable `images.image_N.render` diagram specs
- detected image placement tokens from `<image 1>` / `[image 1]`

Blank `use_this` means the row is ready for review but not selected for materializing by default.

## 2. Render diagrams from the JSON

```bash
npm run questions:render-images -- content/imports/<batch-id>/questions.generated.json
```

This writes SVG files to:

```text
public/diagrams/imports/<batch-id>/
```

It also updates `questions.generated.json` with each image `output_path`.
If a diagram needs design edits, change the row's `images.image_N.render` JSON and rerun this command.

## 3. Materialize approved rows into content JSON

For small visual nudges after rendering, start the local editor:

```bash
npm run questions:edit-diagrams
```

Open the printed `http://localhost:<port>` URL. Select a diagram, click a label/line/path/shape, drag it, then save. This edits the generated SVG directly. Rerunning `questions:render-images` will overwrite manual SVG edits, so use this for final positioning tweaks after renderer-level fixes are done.

Only rows with `selected: true`:

```bash
npm run questions:materialize -- content/imports/<batch-id>/questions.generated.json
```

All rows in the batch:

```bash
npm run questions:materialize -- content/imports/<batch-id>/questions.generated.json --all
```

One row:

```bash
npm run questions:materialize -- content/imports/<batch-id>/questions.generated.json --slug my-question-slug
```

This writes final uploadable files to:

```text
content/questions/<slug>.json
```

Each file includes a tag like `import:<source_fingerprint>`. The upload script uses that tag to avoid re-inserting duplicate questions if GitHub Actions reruns later.

## 4. Upload path

The existing GitHub Action runs on pushes to `main` when `content/questions/*.json` changes:

```text
.github/workflows/upload-questions.yml
```

The action runs:

```bash
npm run questions:upload
```

The upload script loads Supabase credentials from GitHub Secrets in Actions, or from `.env.local` when run locally.

## Spreadsheet columns

Supported columns:

```text
use_this
category
difficulty
question_text
answer_text
explanation_text
bonus_question_text
bonus_answer_text
main_video_youtube_id
resource_videos
ltspice_file_needed
image_1
image_2
image_3
image_4
image_5
image_6
image_7
notes
tags
```

Use `<image 1>` or `[image 1]` in any text field to place the rendered image from the `image_1` prompt.
