# Optional feature dependencies

Final requirements:
- A repository version may instead contain `dependencies` and `extras` mappings.
- Requirement names may use `package[feature]`; multiple feature names use commas and are unioned across all incoming edges.
- Selecting a feature adds that version's dependency mapping for the feature.
- Dependencies may themselves request features.
- If later constraints add a new feature to an already required package, include its dependencies in the same resolution.
- Reject requested features absent from the selected version.
- Feature activation does not alter lock-change counting or returned package mapping.
- Legacy version values remain shorthand for `dependencies` with no extras.
