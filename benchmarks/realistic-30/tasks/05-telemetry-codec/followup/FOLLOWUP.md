# Canonical typed payload codec

Final requirements:
- Add `encode_value(value) -> bytes` and `decode_value(data)` for `None`, booleans, signed 64-bit integers, UTF-8 strings, bytes, lists, and string-keyed dictionaries.
- Tags are: 00 null, 01 false, 02 true, 03 integer plus 8 signed big-endian bytes, 04 string, 05 bytes, 06 list, 07 dictionary.
- Strings and bytes use a 4-byte big-endian byte length.
- Lists use a 4-byte item count followed by encoded values.
- Dictionaries use a 4-byte entry count; each entry is a 4-byte UTF-8 key length, key bytes, then an encoded value.
- Encode dictionary entries in UTF-8 bytewise key order. Reject duplicate decoded keys.
- `decode_value` rejects malformed encodings and trailing bytes.
- `encode_message(type, value)` returns a Frame; `decode_message(frame)` decodes its payload.
