# WAV Interview Cleanup and Chapters

Build `solution/audio_chapters.py` and `solution/__init__.py` so this command works with Python 3.12 and only the standard library:

```bash
python -m solution.audio_chapters inputs/interview.wav inputs/transcript.csv --output output
```

The input is PCM WAV audio and a UTF-8 CSV with the exact header
`speaker,start_seconds,end_seconds,text`. Timestamps are decimal seconds from the
start of the source WAV. The initial recording is mono, signed 16-bit
little-endian PCM.

## Audio and chapter rules

- A silence is a maximal interval of at least 1.2 seconds in which every sample
  has `abs(sample) < 500`.
- Trim all qualifying silence touching the start or end. If the whole recording
  is silence, write a valid WAV with zero data frames.
- Work on frame boundaries. Preserve channel count, sample rate, sample width,
  compression type, and PCM frames. Do not re-encode or resample.
- Starting at retained time zero, seek a cut near each next 10-minute target.
  Among qualifying silences whose midpoint is 8 through 12 minutes after the
  previous boundary, choose the midpoint closest to 10 minutes. Break an
  equal-distance tie toward the earlier cut. Round a midpoint to the nearest
  frame, with an exact half-frame rounded earlier.
- If that window contains no qualifying silence, cut exactly 12 minutes after
  the previous boundary, on the latest frame not after that time. Never add an
  empty final chapter.

Trim and shift transcript intervals to the retained-audio timeline. Clip them to
the retained range and discard zero-length intervals. If an utterance crosses a
chapter boundary, include one clipped segment in each affected chapter. Keep
utterances in input transcript row order within each chapter.

## Exact outputs

Create the requested output directory and replace these outputs deterministically:

- `clean.wav`: all retained frames.
- `chapters/NN.wav`: chapters numbered from `01`, each with the original WAV
  parameters and the exact corresponding frames.
- `chapters.json`: a JSON object with `duration_seconds` (a string with three
  decimal places) and `chapters`, ordered by number. Each chapter object has
  `number` (integer), `file` (exactly `chapters/NN.wav`), `start_seconds`,
  `end_seconds` (three-decimal strings), and `utterances`. Each utterance has
  `speaker`, `start_seconds`, `end_seconds`, and `text`; its times use the
  retained-audio timeline and three decimal places.
- `speaker_time.csv`: exact header `speaker,duration_seconds`, one row per
  distinct input speaker ordered by Unicode code point. Sum each speaker's
  clipped retained `end-start` duration before rounding, then format seconds to
  three decimal places.

The command must tolerate an all-silence input: `clean.wav` has zero frames,
`chapters.json` has an empty chapter list, and every input speaker has zero
duration. Do not write outside `solution/` and the requested output directory.
