# Binary Telemetry Frame Codec

Implement the `telemetry_codec` package using only the Python standard library.

Initial API:
- Immutable `Frame(type, payload)`.
- `encode_frame(frame) -> bytes`.
- `decode_frames(data) -> list[Frame]` consumes an exact complete byte string.

Wire format:
- Magic bytes `A5 5A`.
- One unsigned type byte.
- Two-byte big-endian payload length.
- Exact payload bytes.
- Valid types are 0 through 255 and payloads are at most 65535 bytes.
- Reject wrong magic, malformed values, trailing partial frames, and declared lengths beyond available data.

Run `python run_tests.py`. Edit only files under `telemetry_codec/`. Keep the active goal open for staged pivots.
